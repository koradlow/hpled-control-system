#include <SPI.h>
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
#define RX_CURRENT_LIMIT 20
#define RX_CURRENT_UPDATE 24
#define RX_MESSAGE_CLEAR 25
#define TX_CURRENT_LIMIT 0
#define TX_MESSAGE_CNT 4
#define TX_MESSAGE 5

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
	uint8_t bright;
};

struct RGB_State {
	struct RGB_LED led[LED_COUNT];
	uint8_t current_limit[LED_COUNT];
};

/*
 * Global variables
 */
volatile struct RGB_State rgb_state;
static uint16_t soft_pwm;
static uint8_t ticker = 0;
static uint8_t current_limit;

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

void set_brightness(void) {
		/* /OE duty cycle for LED drivers
	 * 0 = always on */
	analogWrite(ledOEPin, 50);

	/* set current limit 
	 * 251 =  full power, 215 = lowest power */
	setPotiValue(0, 240);
	setPotiValue(1, 240);
	setPotiValue(2, 240);
}

void sendByte(byte value) {
	bitSet(PORTB,ledLatchPinPORTB);
	SPI.transfer(value);
	bitClear(PORTB,ledLatchPinPORTB);
}

void sendBytes(uint16_t value) {
	bitSet(PORTB,ledLatchPinPORTB);
	SPI.transfer((value >> 8));
	SPI.transfer(value);
	bitClear(PORTB,ledLatchPinPORTB);
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
	int current_val = ticker * PWM_STEP;
	uint8_t soft_pwm_idx = 0;
	uint8_t rgb[3];
	for(uint8_t led = 0; led < LED_COUNT; led++) {
		rgb[0] = rgb_state.led[led].r;
		rgb[1] = rgb_state.led[led].g_1;
		rgb[2] = rgb_state.led[led].b;
		for (uint8_t channel = 0; channel < 3; channel++) {
			if (current_val > 255-rgb[channel]) soft_pwm |= _BV(soft_pwm_idx);
			++soft_pwm_idx;
		}
	}
}

void setup() {
	cli();
	/* configure & set the SS pins for SPI communication with slave ICs*/
	pinMode(ledLatchPin, OUTPUT);
	pinMode(potiCsPin, OUTPUT);
	pinMode(enPwr, OUTPUT);
	pinMode(debugLed, OUTPUT);
	
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

	/* initialize Timer1 for periodic callback of soft pwm function (period in usecs) */
	Timer1.initialize(312); 
	Timer1.attachInterrupt(updatePWM);
	
	/* initialize TWI (I2C) - it is configured to behave as an interrupt driven
	 * externally addressable read/write memory with globally accessible transmit
	 * and receive buffers (txbuffer, rxbuffer) */
	init_twi_slave(0x2A, false);
	sei();
	
	set_brightness();
}

void setRGBVal(byte led, byte r, byte g, byte b) {
	rgb_state.led[led].r = r;
	rgb_state.led[led].g_1 = g;
	rgb_state.led[led].g_2 = g;
	rgb_state.led[led].b = b;
}

/* reads the current limit values from the EEPROM and updates the values
 * in the local buffers */
void read_current_limit_eeprom(void) {
	// TODO:
	// read values from EEPROM
	// copy values to txbuffer
	// copy values to rgb_state
	// set RX_CURRENT_UPDATE flag in rxbuffer
}

/* writes the current limit to the EEPROM */
void write_current_limit_eeprom(void) {
	// TODO
}

void set_current_limit() {
	for (uint8_t channel = 0; channel < LED_COUNT; channel++) 
		setPotiValue(channel, rgb_state.current_limit[0]);
}

void loop() {
	/* update the local rgb state by copying the values from the I2C receive
	 * buffer in an atomic operation */
	ATOMIC_BLOCK(ATOMIC_RESTORESTATE) {
		memcpy((void*)&rgb_state, (void*)rxbuffer, sizeof(rgb_state));
	}

	/* update the brightness for all LED drivers */
	analogWrite(ledOEPin, rgb_state.led[0].bright);
	
	/* check if the current limit was updated */
	if (rgb_state.current_limit[0] != current_limit) {
		current_limit = rgb_state.current_limit[0];
		set_current_limit();
	}
	delay(25);
}
// x = (10k - R_pot) / 39



