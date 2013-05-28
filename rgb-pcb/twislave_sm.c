/*
 * ARV ATMega TWI Slave library
 *
 * Acknowledgements:
 * This design of this library is inspired by two existing libraries:
 * "TWI SLave" library by Martin Junghans <jtronics@gmx.de> (www.jtronics.de), 
 * "TWI/I2C library for Wiring & Arduino" by Nicholas Zambetti.
 * 
 * Description:
 * This library implements a small and lightweight I2C slave interface that
 * can be addressed and manipulated similar to standard EEPROMs. 
 * 
 * A transaction starts by a write operation to set the EEPROM address, 
 * followed by an arbitrary number of write/read requests that are 
 * put-into / read-from the buffers while increasing the address automatically.
 * 
 * The functionality is based on receive and transmit buffers that can be 
 * accessed via I2C and from the user program.
 * 
 * Usage:
 * External over I2C:
 * The read / write address is defined by performing a 1 byte write transmission
 * (transmissions with length == 1 are generally interpreted as an address).
 * 
 * Following write operations (lenght > 1) will be written into the
 * rxbuffer at the offset defined by the previously set address.
 * !write operations will fail if the address is not set
 * 
 * Following  read operations will be served from the txbuffer at the offset
 * defined by the previously set address.
 * !read operations will start from offset=0 if the address is not set
 * 
 * Internal via Software:
 * The library exposes the receive and transmit buffers as rx/txbuffer in
 * the global namespace.
 * 
 * It is possible to register callback functions that will be triggered
 * when a receive operation is completed or when a transmit operation
 * is about to begin. These functions can be used to prevent the need to
 * constantly poll the buffers for changes or implement sophisticated behavior
 * based on the address of the transmit/receive operations.
 *  
 * License:
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * any later version.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Suite 500, Boston, MA  02110-1335  USA
 */

#include <util/twi.h>		/* AVR TWI Statuscode definitions */
#include <avr/interrupt.h>
#include <stdint.h>
#include <string.h>
#include "twislave_sm.h"

/*
 * Macros for setting TWI hardware behavior during next transaction
 */
/* send ACK after receive / expect ACK after transmit */ 
#define TWCR_ACK 	TWCR = _BV(TWEN)| _BV(TWIE) | _BV(TWINT) | _BV(TWEA);
/* send NACK after receive / expect NACK after transmit */
#define TWCR_NACK 	TWCR = _BV(TWEN)| _BV(TWIE) | _BV(TWINT);

/*
 * Local types and variables
 */

/* AVR TWI Slave address offset in TWAR (TWI address) register */
#ifndef TWI_ADDR_BIT_OFFSET
	#define TWI_ADDR_BIT_OFFSET 1
#endif
/* AVR TWI General call bit in TWAR (TWI address) register */
#ifndef TWI_GEN_BIT
	#define TWI_GEN_BIT 0
#endif

/* define local types */
enum twi_state_t {
	TWI_IDLE = 0x00,
	TWI_SL_RECEIVE = 0x01,
	TWI_SL_TRANSMIT = 0x02
};
  
/* declare module local variables */
static volatile enum twi_state_t twi_state;
static volatile uint8_t write_destination;
static volatile uint8_t buffer_addr;
static volatile uint8_t internal_buffer[BUFFER_SIZE];
static void (*sl_receive_cb)(uint8_t, uint8_t);
static void (*sl_transmit_cb)(uint8_t);

/* define empty callback functions that are called if the user doesn't register
 * callback functions */
inline void empty_sl_receive_cb(uint8_t a, uint8_t b){};
inline void empty_sl_transmit_cb(uint8_t a){};

/*
 * public API implementation
 */
/* initialize the TWI hardware to act as a slave.
 * addr:	slave address, range 0-127
 * ena_general_call:	react to transmissions to the general call address */
void init_twi_slave(uint8_t adr, bool ena_general_call)
{
	cli();

	/* Set the slave address
	 * 7 address bits (msb..bit 1), 
	 * 1 general call bit (lsb) -> enable recognition of the 
	 * general call address (0x00) */
	TWAR = adr << TWI_ADDR_BIT_OFFSET | ena_general_call << TWI_GEN_BIT;

	/* TWEA: TWI Enable Acknowledge Bit
	 * TWEN: TWI Enable Bit
	 * TWIE: TWI Interrupt Bit */
	TWCR = _BV(TWEA) | _BV(TWEN) | _BV(TWIE);

	/* Set empty callback functions */
	sl_receive_cb = empty_sl_receive_cb;
	sl_transmit_cb = empty_sl_transmit_cb;

	/* Initialize state machine */
	twi_state = TWI_IDLE;

	sei();
}

/* register callback function that will be executed when a slave receive
 * transmission has been completed. 
 * rx_address: destination of the write operation
 * rx_length: number of received bytes */
void register_sl_receive_cb(void (*function)(uint8_t rx_address, uint8_t rx_length)) {
	sl_receive_cb = function;
}

/* register callback function that will be executed when a master requests
 * data from a slave
 * tx_address: target of the read operation */
 void register_sl_transmit_cb(void (*function)(uint8_t tx_address)) {
	sl_transmit_cb = function;
}

/*
 * Module internal helper functions
 */

/* relinquish bus in reaction to bus error condition, or after completed
 * transmission */
void twi_stop(void)
{
	/* send stop condition */
	TWCR = _BV(TWEN) | _BV(TWIE) | _BV(TWEA) | _BV(TWINT) | _BV(TWSTO);

	/* wait for stop condition to be executed on bus
	 * !TWINT is not set after a stop condition */
	while(TWCR & _BV(TWSTO)){
		continue;
	}

	twi_state = TWI_IDLE;
}

/* TWI interrupt service handler routine.
 * The TWI interrupt is triggered whenever user interaction is required
 * because an event happened on the bus. The hardware will delay reaction
 * until a write operation to the TWCR register is performed */
ISR (TWI_vect)  
{
	switch (TW_STATUS)
		{
		/* Status Codes for Slave Receiver Mode */
		case TW_SR_SLA_ACK:		/* own SLA+W received, ACK returned */
		case TW_SR_GCALL_ACK:	/* general address received, ACK returned */
		case TW_SR_ARB_LOST_SLA_ACK:	/* arbitration lost as master, 
													 * own SLA+W received, ACK returned */
		case TW_SR_ARB_LOST_GCALL_ACK:	/* arbitration lost as master,
													 * general address received, ACK returned */
			/* enter slave receive state and start new transmission */
			twi_state = TWI_SL_RECEIVE;
			buffer_addr = 0;
			TWCR_ACK;
			break;
		case TW_SR_DATA_ACK:	/* received data after own SLA+W, ACK returned */
		case TW_SR_GCALL_DATA_ACK:	/* received data after general addr, ACK returned */
			/* try to put the data into the internal buffer */
			if(buffer_addr < BUFFER_SIZE) {
				internal_buffer[buffer_addr++] = TWDR;
				TWCR_ACK;
			} else
				TWCR_NACK;
			break;
		case TW_SR_STOP:	/* STOP or repeated START condition received */
			/* ACK, release the bus and wait for stop condition */
			twi_stop();
			
			/* if the transmission is only 1 byte long interpret it as an 
			 * read/write address */
			if (buffer_addr == 1)
				write_destination = internal_buffer[0];
			/* received a complete transmission. If a valid write address was
			 * provided copy data to destination of the global receive buffer 
			 * and inform the user about the update */
			else if (write_destination + buffer_addr < BUFFER_SIZE) {
				memcpy((void*)&rxbuffer[write_destination], (void*)&internal_buffer[0], buffer_addr);
				sl_receive_cb(write_destination, buffer_addr);
				write_destination += buffer_addr;
			}
			/* reset internal buffer address, and acknowledge the transfer */
			buffer_addr = 0;
			twi_state = TWI_IDLE;
			TWCR_ACK;
			break;
		/* Data + NACK can be received when the slave signalled to the master
		 * that no more data can be received. In this case ignore the data and
		 * NACK it */
		case TW_SR_DATA_NACK:		/* received data after own SLA+W, NACK returned */
		case TW_SR_GCALL_DATA_NACK:	/* received data after general addr, NACK returned */
			TWCR_NACK;
			break;
		
		/* Status Codes for Slave Transmitter Mode */
		case TW_ST_SLA_ACK:		/* own SLA+R received, ACK returned */
			/* enter slave transmit state and inform user about the request */
			twi_state = TWI_SL_TRANSMIT;
			if (write_destination >= BUFFER_SIZE)
				write_destination = 0;
			sl_transmit_cb(write_destination);
		case TW_ST_DATA_ACK:	/* byte transmitted, received ACK */
			/* transmit next byte from buffer */
			TWDR = rxbuffer[write_destination++]; //todo: should be txbuffer
			/* more data to for transmission available?
			 * TWCR_NACK signals the end of transmission, next state is either
			 * TW_ST_DATA_NACK or TW_ST_LAST_DATA depending on weather the Master
			 * transmits N/ACK after the final byte */
			if (write_destination < BUFFER_SIZE) {
				TWCR_ACK;
			} else { 
				TWCR_NACK;
			}
			break;
		case TW_ST_DATA_NACK: /* last byte transmitted, received NACK -> done */
		case TW_ST_LAST_DATA: /* last byte transmitted, received ACK -> done */
			TWCR_ACK
			twi_state = TWI_IDLE;
			break;

		/* Miscellaneous States */
		case TW_NO_INFO:		/* No relevant state information available */
			break;
		case TW_BUS_ERROR:	/* Bus error due illegal START or STOP condition */
			twi_stop();
			break;
		}
}
