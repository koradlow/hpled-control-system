#!/usr/bin/env python3
import quick2wire.i2c as i2c
import time

def set_brightness(value):
	dest_brightness = 0x14;
	print("setting brightness to %d" % value)
	bus.transaction(
		i2c.writing_bytes(address, dest_brightness),
		i2c.writing_bytes(address, value, value, value, value, 0x01))

def set_led(led, *rgb):
	dest_led = 0x05 * led;
	bus.transaction(
		i2c.writing_bytes(address, dest_led),
		i2c.writing_bytes(address, rgb)

def read(source, bytes):
	result = bus.transaction(
		i2c.writing_bytes(address, source),
		i2c.reading(address, bytes))

		return result[0]

address = 0x2A
dest_register = 0x00
source_register = 0x13

with i2c.I2CMaster() as bus:    
		bus.transaction( 
			i2c.writing_bytes(address, dest_register),
			i2c.writing_bytes(address, 0xFF, 0x00, 0x00, 0x00, 0x00))
		time.sleep(5)
		set_brightness(210)
		read_results = bus.transaction(
				i2c.writing_bytes(address, source_register),
				i2c.reading(address, 26))

		print("read %d bytes" % len(read_results[0]))
		for n in read_results:
			for i in n:
				print("%02x" % i)
			print(" ")
