#include <SPI.h>
#include <EEPROM.h>
#include <TimerOne.h>
#include <util/atomic.h>

extern "C" {
	#include <twislave_sm.h>
}

/*
 * Macros to set and clear bits
 */
#ifndef cbi
#define cbi(sfr, bit) (_SFR_BYTE(sfr) &= ~_BV(bit))
#endif
#ifndef sbi
#define sbi(sfr, bit) (_SFR_BYTE(sfr) |= _BV(bit))
#endif 

/*
 * Module constants and pin definitions
 */
#define PWM_LEVELS 32
#define PWM_STEP 256/PWM_LEVELS
#define LED_COUNT 4

/* define the offsets in the receive and transmit buffers for I2C (TWI) */
#define RX_RGB_LED 0
#define RX_CURRENT_LIMIT 16
#define RX_CURRENT_UPDATE 20
#define RX_CURRENT_BRIGHTNESS 21
#define RX_MESSAGE_CLEAR 25
#define TX_CURRENT_LIMIT 0
#define TX_MESSAGE_CNT 4
#define TX_MESSAGE 5
#define EEPROM_CURRENT 0

/* the latch / /CS pin has to be on portB to allow setting it's value with 
 * direct port access to improve the execution speed */
const int ledLatchPin = 9;
const int ledLatchPinPORTB = ledLatchPin - 8;
const int potiCsPin = 8;
const int potiCsPinPORTB = potiCsPin - 8;
const int enPwr = 6;
const int debugLed = 7;
const int ledOEPin = 5;
const int ssPin = 10;

/* 
 * Data structures 
 */
struct RGB_LED {
	uint8_t r;
	uint8_t g_1;
	uint8_t g_2;
	uint8_t b;
};

struct RGB_State {
	struct RGB_LED led[LED_COUNT];
	uint8_t current_limit[LED_COUNT];
	uint8_t dummy_byte;	// for correct memory mapping to rx buffer
	uint8_t brightness;
};

/*
 * Global variables
 */
volatile struct RGB_State rgb_state;
static volatile uint16_t soft_pwm;
static volatile uint8_t ticker = 0;
static volatile bool twi_rx_event;

/*
 * Helper functions
 */
/* the Poti has a range of 10kOhm divided in 255 discrete steps,
 * set Terminal Bx to gnd and measure resistance between Wx and gnd.
 * Global interrupts are disabled during execution of this function to
 * prevent intervention with other functions that make use of SPI
 * --> value 0 => ~10k Ohm
 * --> value 215 => ~1.5k Ohm 
 * --> value 251 => ~200 Ohm */
void setPotiValue(byte channel, byte value) {
	cli();
	bitClear(PORTB, potiCsPinPORTB);
	SPI.transfer(channel);
	SPI.transfer(value);
	bitSet(PORTB, potiCsPinPORTB);
	sei();
}

/* reads the lower 4 bits of the I2C slave address for this board set with
 * a 4-way DIP switch */
uint8_t read_i2c_slave_address_dip(void) {
	uint8_t i2c_addr = digitalRead(A0) | digitalRead(A1) << 1 | 
			digitalRead(A2) << 2 | digitalRead(A3) << 3;
	return i2c_addr;
}

/* reads the current limit values from the EEPROM and updates the values
 * in the local buffers */
void read_current_limit_eeprom(void) {
	for(uint8_t channel = 0; channel < LED_COUNT; channel++) {
		rgb_state.current_limit[channel] = EEPROM.read(EEPROM_CURRENT+channel);
	}
	memcpy((void*)&rxbuffer[RX_CURRENT_LIMIT], (void*)&rgb_state.current_limit[0], LED_COUNT);
	memcpy((void*)&txbuffer[TX_CURRENT_LIMIT], (void*)&rgb_state.current_limit[0], LED_COUNT);
	rxbuffer[RX_CURRENT_UPDATE] = true;
}

/* writes the current limit to the EEPROM */
void write_current_limit_eeprom(void) {
	for(uint8_t channel = 0; channel < LED_COUNT; channel++)
		EEPROM.write(EEPROM_CURRENT+channel, rgb_state.current_limit[channel]);
}

void set_current_limit() {
	for (uint8_t channel = 0; channel < LED_COUNT; channel++) 
		setPotiValue(channel, rgb_state.current_limit[channel]);
}

void sendByte(byte value) {
	bitSet(PORTB,ledLatchPinPORTB);
	SPI.transfer(value);
	bitClear(PORTB,ledLatchPinPORTB);
}

void sendBytes(uint16_t value) {
	SPI.transfer((value >> 8));
	SPI.transfer(value);
	bitSet(PORTB,ledLatchPinPORTB);
	bitClear(PORTB,ledLatchPinPORTB);
}

/* set flag to notify main loop about TWI rxbuffer update */
void twi_sl_rcv_cb(uint8_t addr, uint8_t length) {
	twi_rx_event = true;
}

/* calculate the bitfield for 8 PWM channels */
uint8_t pwm_bitfield(uint8_t idx, uint8_t current_val) {
	static uint8_t bitfield = 0;
	static uint8_t soft_pwm_idx = 0;
	static uint8_t rgb[4];
	for(uint8_t led = idx; led < idx+2; led++) {
		rgb[0] = rgb_state.led[led].r;
		rgb[1] = rgb_state.led[led].g_1;
		rgb[2] = rgb_state.led[led].g_2;
		rgb[3] = rgb_state.led[led].b;
		for (uint8_t channel = 0; channel < 4; channel++) {
				if (current_val > 255-rgb[channel])
					bitfield |= _BV(soft_pwm_idx);
				++soft_pwm_idx;
			}
		}
		return bitfield;
}

/* calculate the soft pwm values, and output them via SPI
 * (periodic callback function for Timer1) */
void updatePWM() {
	/* update output at beginning of function to account for variable
	 * execution time of the function (lower jitter) */ 
	sendBytes(soft_pwm);

	/* if the soft pwm ticker / comperator overflows, reset the current
	 * soft-pwm values */
	if ( ++ticker >= PWM_LEVELS ){
		ticker = 0;
		soft_pwm = 0;
	}

	/* calculate the pwm values for the next iteration */
	uint8_t current_val = ticker * PWM_STEP;
	soft_pwm |= pwm_bitfield(0, current_val);
	soft_pwm |= pwm_bitfield(2, current_val) << 8;
}

void setup() {
	cli();
	/* configure & set the SS pins for SPI communication with slave ICs*/
	pinMode(ledLatchPin, OUTPUT);
	pinMode(potiCsPin, OUTPUT);
	pinMode(enPwr, OUTPUT);
	pinMode(debugLed, OUTPUT);
	pinMode(ledOEPin, OUTPUT);
	
	digitalWrite(ledLatchPin, LOW);
	digitalWrite(potiCsPin, HIGH);
	digitalWrite(enPwr, HIGH);
	
	/* Enable SPI output and configure non-default options.
	 * Both STP04CM05 and AD5204 IC support SPI in high speed mode
	 * 
	 * Important: with the first revision of the pcb the /SS pin has to 
	 * be set to output manually to prevent the SPI from entering slave mode */
	pinMode(ssPin, OUTPUT);
	SPI.begin();
	sbi(SPCR, SPI2X);

	/* read the current limit values from EEPROM to restore the old state */
	read_current_limit_eeprom();

	/* initialize Timer1 for periodic callback of soft pwm function (period in usecs) */
	Timer1.initialize( 400 ); 
	Timer1.attachInterrupt(updatePWM);

	/* initialize TWI (I2C) - it is configured to behave as an interrupt driven
	 * externally addressable read/write memory with globally accessible transmit
	 * and receive buffers (txbuffer, rxbuffer) */
	uint8_t i2c_sl_addr = 0x20 | read_i2c_slave_address_dip();
	// de-activate internal pullups for twi.
	digitalWrite(SDA, 0);
	digitalWrite(SCL, 0);
	init_twi_slave(i2c_sl_addr, false);
	register_sl_receive_cb(twi_sl_rcv_cb);
	sei();
}

void loop() {
	/* update the local rgb state by copying the values from the I2C receive
	* buffer, if the data was received */
	if (twi_rx_event) {
		memcpy((void*)&rgb_state, (void*)&rxbuffer[0], BUFFER_SIZE);
		twi_rx_event = false;
	}
	/* update the brightness for all LED drivers */
	analogWrite(ledOEPin, rgb_state.brightness);
	
	/* check if the current limit was updated */
	if (rxbuffer[RX_CURRENT_UPDATE] != 0x00) {
		set_current_limit();
		memcpy((void*)&txbuffer[TX_CURRENT_LIMIT], (void*)&rgb_state.current_limit[0], LED_COUNT);
		rxbuffer[RX_CURRENT_UPDATE] = false;
		write_current_limit_eeprom();
	}
	delay(25);
}
// x = (10k - R_pot) / 39
