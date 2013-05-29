#include <SPI.h>
#include <EEPROM.h>
#include <TimerOne.h>
#include "TimerZero.h"
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
static volatile uint16_t soft_pwm;
static uint8_t ticker = 0;
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
		setPotiValue(channel, rgb_state.current_limit[0]);
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

/* set flag to notify main loop about TWI rxbuffer update */
void twi_sl_rcv_cb(uint8_t addr, uint8_t length) {
	twi_rx_event = true;
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
volatile uint8_t tick;
volatile uint8_t pwm_status;
void togglePin(void) {
	
	if ( ++tick >= 32 ) {
		tick = 0;
		pwm_status = 0;
		bitClear(PORTD, PD5);
	}
	if (tick > 8)
		bitSet(PORTD, PD5);
}

void setup() {
	cli();
	/* configure & set the SS pins for SPI communication with slave ICs*/
	pinMode(ledOEPin, OUTPUT);
	
	Timer0.initialize(63);
	Timer0.attachInterrupt(togglePin);
	sei();
}

void loop() {
	
	delay(25);
}
// x = (10k - R_pot) / 39



