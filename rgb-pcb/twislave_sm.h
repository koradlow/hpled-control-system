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

#ifndef TWISLAVE_H
#define TWISLAVE_H

#include <stdbool.h>

/* Size for transmit and receive buffers */
#define BUFFER_SIZE 32

/*
 * Global variables
 */
volatile uint8_t rxbuffer[BUFFER_SIZE];
volatile uint8_t txbuffer[BUFFER_SIZE];

/*
 * Public API 
 */
void init_twi_slave(uint8_t addr, bool ena_general_call);
void register_sl_receive_cb(void (*)(uint8_t, uint8_t));
void register_sl_transmit_cb(void (*)(uint8_t));

#endif
