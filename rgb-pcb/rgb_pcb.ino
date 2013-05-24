#include <SPI.h>
#include <TimerOne.h>
#include <DigitalToggle.h>

#ifndef cbi
#define cbi(sfr, bit) (_SFR_BYTE(sfr) &= ~_BV(bit))
#endif
#ifndef sbi
#define sbi(sfr, bit) (_SFR_BYTE(sfr) |= _BV(bit))
#endif 

#define PWM_LEVELS 64
#define PWM_STEP 256/PWM_LEVELS
#define LED_COUNT 4
#define SPEED 3
#define WAIT 500
#define BLINK_DELAY 50

#define DATA_MODE CPOL
//#define DATA_MODE CPHA


/* the latch / /CS pin has to be on portB to allow setting it's value with 
 * direct port access to improve the execution speed */
const int ledLatchPin = 9;
const int ledLatchPinPORTB = ledLatchPin - 8;
const int potiCsPin = 8;
const int potiCsPinPORTB = potiCsPin - 8;
const int enPwr = 6;
const int debugLed = 7;
const int ledOEPin = 5;

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
uint16_t soft_pwm;
uint8_t ticker = 0;

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
	/* configure & set the SS pins for SPI communication with slave ICs*/
	pinMode(ledLatchPin, OUTPUT);
	pinMode(potiCsPin, OUTPUT);
	pinMode(enPwr, OUTPUT);
	pinMode(debugLed, OUTPUT);
	
	digitalWrite(ledLatchPin, LOW);
	digitalWrite(potiCsPin, HIGH);
	digitalWrite(enPwr, HIGH);
	
	/* Enable SPI output and configure non-default options.
	 * Both STP04CM05 and AD5204 IC support SPI in high speed mode,
	 * STP04CM05 seems to sample too late -> SPI needs to be set to CPHA mode
	 * where data is assumed to be sampled at falling clk edge.
	 * AD5204 has problems with this data mode, but since communication with
	 * the IC is less frequent, the default mode for the program is CPHA mode,
	 * and the data mode is switched to CPHA=0 (sample at rising edge) before 
	 * every transfer to the AD5204 and reset afterwards */
	SPI.begin();
	sbi(SPCR, SPI2X);

	/* initialize Timer1 for periodic callback of soft pwm function (period in usecs) */
	Timer1.initialize(200); 
	Timer1.attachInterrupt(updatePWM);
}

void setRGBVal(byte led, byte r, byte g, byte b) {
	rgb_state.led[led].r = r;
	rgb_state.led[led].g_1 = g;
	rgb_state.led[led].g_2 = g;
	rgb_state.led[led].b = b;
}

void test_brightness(uint8_t channel) {
	const byte lower_bound =  215;
	const byte upper_bound = 251;
	for( int p = lower_bound; p <= upper_bound; p++) {
		setPotiValue(channel, p);
		delay(250);
		digitalWrite(debugLed, !digitalRead(debugLed));
	}
	for( int p = upper_bound; p >= lower_bound; p--) {
		setPotiValue(channel, p);
		delay(250);
		digitalWrite(debugLed, !digitalRead(debugLed));
	}
}

void blink(uint8_t blink_count) {
	for (uint8_t cnt = 0; cnt < blink_count; cnt++) {
		analogWrite(ledOEPin, 255);
		digitalWrite(debugLed, !digitalRead(debugLed));
		delay(BLINK_DELAY);
		analogWrite(ledOEPin, 26);
		digitalWrite(debugLed, !digitalRead(debugLed));
		delay(BLINK_DELAY);
	}
}

void loop() {
	

	/* OE duty = 90% */
	analogWrite(ledOEPin, 50);

	/* set current limit 
	 * 251 =  full power, 215 = lowest power */
	setPotiValue(0, 235);
	setPotiValue(1, 235);
	setPotiValue(2, 235);
	
	/* RED to Yelllow */
	for (int i = 0; i < 256; i++) {
		setRGBVal(0, 255, 0, i);
		setRGBVal(1, 255, i, 255);
		setRGBVal(2, 255-i, 255, 255);
		setRGBVal(3, 0, 255, 255-i);
		delay(SPEED);
	}

	/* Yellow to white */
	for (int i = 0; i < 256; i++) {
		setRGBVal(0, 255, i, 255);
		setRGBVal(1, 255-i, 255, 255);
		setRGBVal(2, 0, 255, 255-i);
		setRGBVal(3, i, 255, 0);
		delay(SPEED);
	}

	/* White to Azure */
	for (int i = 0; i < 256; i++) {
		setRGBVal(0, 255-i, 255, 255);
		setRGBVal(1, 0, 255, 255-i);
		setRGBVal(2, i, 255, 0);
		setRGBVal(3, 255, 255-i, 0);
		delay(SPEED);
	}

	/* Azure to Blue */
	for (int i = 0; i < 256; i++) {
		setRGBVal(0, 0, 255, 255-i);
		setRGBVal(1, i, 255, 0);
		setRGBVal(2, 255, 255-i, 0);
		setRGBVal(3, 255, 0, i);
		delay(SPEED);
	}
	
	/* Blue to Purple */
	for (int i = 0; i < 256; i++) {
		setRGBVal(0, i, 255, 0);
		setRGBVal(1, 255, 255-i, 0);
		setRGBVal(2, 255, 0, i);
		setRGBVal(3, 255, i, 255);
		delay(SPEED);
	}

	/* Purple to Red */
	for (int i = 0; i < 256; i++) {
		setRGBVal(0, 255, 255-i, 0);
		setRGBVal(1, 255, 0, i);
		setRGBVal(2, 255, i, 255);
		setRGBVal(3, 255-i, 255, 255);
		delay(SPEED);
	}
}
// x = (10k - R_pot) / 39



