/*#################################################################################################
	Title	: TWI SLave
	Author	: Martin Junghans <jtronics@gmx.de>
	Hompage	: www.jtronics.de
	Software: AVR-GCC / Programmers Notpad 2
	License	: GNU General Public License 
	
	Aufgabe	:
	Betrieb eines AVRs mit Hardware-TWI-Schnittstelle als Slave. 
	Zu Beginn muss init_twi_slave mit der gewünschten Slave-Adresse als Parameter aufgerufen werden. 
	Der Datenaustausch mit dem Master erfolgt über die Buffer rxbuffer und txbuffer, auf die von Master und Slave zugegriffen werden kann. 
	rxbuffer und txbuffer sind globale Variablen (Array aus uint8_t).
	
	Ablauf:
	Die Ansteuerung des rxbuffers, in den der Master schreiben kann, erfolgt ähnlich wie bei einem normalen I2C-EEPROM.
	Man sendet zunächst die Bufferposition, an die man schreiben will, und dann die Daten. Die Bufferposition wird 
	automatisch hochgezählt, sodass man mehrere Datenbytes hintereinander schreiben kann, ohne jedesmal
	die Bufferadresse zu schreiben.
	Um den txbuffer vom Master aus zu lesen, überträgt man zunächst in einem Schreibzugriff die gewünschte Bufferposition und
	liest dann nach einem repeated start die Daten aus. Die Bufferposition wird automatisch hochgezählt, sodass man mehrere
	Datenbytes hintereinander lesen kann, ohne jedesmal die Bufferposition zu schreiben.

	Abgefangene Fehlbedienung durch den Master:
	- Lesen über die Grenze des txbuffers hinaus
	- Schreiben über die Grenzen des rxbuffers hinaus
	- Angabe einer ungültigen Schreib/Lese-Adresse
	- Lesezuggriff, ohne vorher Leseadresse geschrieben zu haben
	
	LICENSE:
    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 2 of the License, or
    any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

//#################################################################################################*/

#include <util/twi.h> 								// Bezeichnungen für Statuscodes in TWSR
#include <avr/interrupt.h> 							// behandlung der Interrupts
#include <stdint.h> 								// definiert Datentyp uint8_t
#include "twislave_sm.h" 								

//#################################### Macros
//ACK nach empfangenen Daten senden/ ACK nach gesendeten Daten erwarten
#define TWCR_ACK 	TWCR = (1<<TWEN)|(1<<TWIE)|(1<<TWINT)|(1<<TWEA)|(0<<TWSTA)|(0<<TWSTO)|(0<<TWWC);  

//NACK nach empfangenen Daten senden/ NACK nach gesendeten Daten erwarten     
#define TWCR_NACK 	TWCR = (1<<TWEN)|(1<<TWIE)|(1<<TWINT)|(0<<TWEA)|(0<<TWSTA)|(0<<TWSTO)|(0<<TWWC);

//switched to the non adressed slave mode...
#define TWCR_RESET 	TWCR = (1<<TWEN)|(1<<TWIE)|(1<<TWINT)|(1<<TWEA)|(0<<TWSTA)|(0<<TWSTO)|(0<<TWWC);  

//############ Module local variables
static uint8_t transm_len = 0;
static uint8_t prev_data;

//########################################################################################## init_twi_slave 
void init_twi_slave(uint8_t adr, bool ena_general_call)
{
	cli();

	/* Set the slave address - 7 address bits, 1 general call bit (lsb) to recognition
	 * of the general call address (0x00) */
	TWAR = adr << TWI_ADR_BITS | ena_general_call << TWI_GEN_BIT;
	/* Put the TWI interface to slave mode:
	 * TWSTA: TWI START Condition Bit (0 for slave mode)
	 * TWSTO: TWI STOP Condition Bit (0 for slave mode) */
	TWCR &= ~(1<<TWSTA)|(1<<TWSTO);
	/* TWEA: TWI Enable Acknowledge Bit
	 * TWEN: TWI Enable Bit
	 * TWIE: TWI Interrupt Bit */
	TWCR|= (1<<TWEA) | (1<<TWEN)|(1<<TWIE); 	
	
	buffer_adr=0xFF; 
	state = ST_IDLE;
	
	sei();
}

//########################################################################################## ISR (TWI_vect) 
//ISR, die bei einem Ereignis auf dem Bus ausgelöst wird. Im Register TWSR befindet sich dann 
//ein Statuscode, anhand dessen die Situation festgestellt werden kann.
ISR (TWI_vect)  
{
	uint8_t twi_status = TW_STATUS;
	switch (state)
		{
			case ST_IDLE:
				transm_len = 0;
				buffer_adr = 0xFF;
				switch (twi_status) {
					case TW_SR_SLA_ACK:
						state = ST_RECEIVE;
						break;
					case TW_ST_SLA_ACK:
						if (buffer_adr == 0xFF) buffer_adr = 0;
						TWDR = rxbuffer[buffer_adr++]; //todo: should be write buffer
						state = ST_TRANSMIT;
				}
				TWCR_ACK
				break;
			
			case ST_RECEIVE:
				switch (twi_status) {
					/* new byte of data received */
					case TW_SR_DATA_ACK:
						/* a transmission with a length > 1 is a data transmission and 
						 * will be stored in the receive buffer if a valid address is set */
						if (transm_len++ >= 1) {
							if (buffer_adr == 0xFF) {
								TWCR_NACK
								break;
							}
							rxbuffer[buffer_adr++] = prev_data;
							if (buffer_adr >= buffer_size) {
								TWCR_NACK						/* signal end-of-buffer to master */
								break;
							}
						}
						prev_data = TWDR;		/* data will be interpreted in next iteration */
						TWCR_ACK
						break;
					/* STOP condition or repeated START condition received */
					case TW_SR_STOP:
						/* if only 1 byte was received before STOP, interpret as address
						 * and remain in RECEIVE state for data */
						if (transm_len == 1) {
							if (prev_data <= buffer_size) {
								buffer_adr = prev_data;		/* valid address received, wait for data */
								transm_len = 0;
							}
							else {
								TWCR_NACK /* invalid address, inform master about error */
								break;
							}
						/* if more than 1 byte was received before STOP, interpret as data.
						 * Store the last received byte in the buffer and end transmission */
						} else {
							rxbuffer[buffer_adr] = prev_data;
							state = ST_IDLE;
						}
						TWCR_ACK
						break;
					/* this slave received a transmit request */
					case TW_ST_SLA_ACK:
						if (buffer_adr == 0xFF) buffer_adr = 0;
						TWDR = rxbuffer[buffer_adr++];
						state = ST_TRANSMIT;
						TWCR_ACK
						break;
					/* this slave received a receive request (after setting address) */
					case TW_SR_SLA_ACK:
						state = ST_RECEIVE;
						TWCR_ACK;
						break;
					default:
						state = ST_IDLE;
						TWCR_NACK
				} // end.switch(twi_status) [state = ST_RECEIVE]
				break;
			
			case ST_TRANSMIT:
				switch (twi_status) {
					case TW_ST_DATA_ACK:
						TWDR = rxbuffer[buffer_adr++];
						if (buffer_adr >= buffer_size) {
							TWCR_NACK				/* signal end-of-buffer to master */
							state = ST_IDLE;
							break;
						}
						TWCR_ACK
						break;
					/* master signaled end of read operation */
					case TW_ST_DATA_NACK:
						state = ST_IDLE;
						TWCR_ACK
						break;
					/* unhandled event received */
					default:
						state = ST_IDLE;
						TWCR_NACK
				} // end.switch(twi_status) [state = ST_TRANSMIT]
		} //end.switch(state)
} //end.ISR(TWI_vect)
