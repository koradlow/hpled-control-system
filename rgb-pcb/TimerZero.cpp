#include "TimerZero.h"

TimerZero Timer0;              // preinstatiate

ISR(TIMER0_COMPA_vect)          // interrupt service routine that wraps a user defined function supplied by attachInterrupt
{
	Timer0.isrCallback();
}


void TimerZero::initialize(long microseconds)
{
  TCCR0A = _BV(WGM01);		// user timer0 in "clear timer on compare match" mode
  TCCR0B = 0;
  setPeriod(microseconds);
}

void TimerZero::setPeriod(long microseconds)		// AR modified for atomic access
{
  // assume 2 cycles per instruction, --> 1 tick / microsecond
  long cycles = (F_CPU / 1000000) * microseconds;                                // the counter runs backwards after TOP, interrupt is at BOTTOM so divide microseconds by 2
  if(cycles < TIMER_0_RESOLUTION)              clockSelectBits = _BV(CS00);              // no prescale, full xtal
  else if((cycles >>= 3) < TIMER_0_RESOLUTION) clockSelectBits = _BV(CS01);              // prescale by /8
  else if((cycles >>= 3) < TIMER_0_RESOLUTION) clockSelectBits = _BV(CS01) | _BV(CS00);  // prescale by /64
  else if((cycles >>= 2) < TIMER_0_RESOLUTION) clockSelectBits = _BV(CS02);              // prescale by /256
  else if((cycles >>= 2) < TIMER_0_RESOLUTION) clockSelectBits = _BV(CS02) | _BV(CS00);  // prescale by /1024
  else        cycles = TIMER_0_RESOLUTION - 1, clockSelectBits = _BV(CS02) | _BV(CS00);  // request was out of bounds, set as maximum
  
  // set the compare value
  OCR0A = cycles;
  
  TCCR0B &= ~(_BV(CS00) | _BV(CS01) | _BV(CS02));
  TCCR0B |= clockSelectBits;                                          // reset clock select register, and starts the clock
}

void TimerZero::attachInterrupt(void (*isr)(), long microseconds)
{
  if(microseconds > 0) setPeriod(microseconds);
  isrCallback = isr;                                       // register the user's callback with the real ISR
  TIMSK0 = _BV(OCIE0A);                                     // sets the timer overflow interrupt enable bit
}

void TimerZero::detachInterrupt()
{
  TIMSK0 &= ~_BV(OCIE0A);                                   // clears the timer overflow interrupt enable bit 
}

void TimerZero::start()	// AR addition, renamed by Lex to reflect it's actual role
{
  unsigned int tcnt0;
  
  TIMSK0 |= _BV(OCIE0A);        // Interrupt Mask Register, enable overflow compare interrupt
  
  oldSREG = SREG;				// AR - save status register
  cli();						// AR - Disable interrupts
  TCNT0 = 0;        // Reset counter register to 0        	
  SREG = oldSREG;          		// AR - Restore status register

  do {	// Nothing -- wait until timer moved on from zero - otherwise get a phantom interrupt
	oldSREG = SREG;
	cli();
	tcnt0 = TCNT0;
	SREG = oldSREG;
  } while (tcnt0==0); 
 
//  TIFR1 = 0xff;              		// AR - Clear interrupt flags
//  TIMSK1 = _BV(TOIE1);              // sets the timer overflow interrupt enable bit
}

void TimerZero::stop()
{
  TCCR0B &= ~(_BV(CS00) | _BV(CS01) | _BV(CS02));          // clears all clock selects bits
}
