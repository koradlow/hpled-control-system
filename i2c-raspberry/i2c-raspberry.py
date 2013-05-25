#!/usr/bin/env python3
import quick2wire.i2c as i2c
import time

address = 0x2A

def set_brightness(value):
	print("setting brightness to %d" % value)
	with i2c.I2CMaster() as bus:
		dest_brightness = 0x14;
		bus.transaction(
			i2c.writing_bytes(address, dest_brightness),
			i2c.writing_bytes(address, value, value, value, value, 0x01))

def set_led(led, rgb):
	with i2c.I2CMaster() as bus:
		dest_led = 0x05 * led;
		bus.transaction(
			i2c.writing_bytes(address, dest_led),
			i2c.writing_bytes(address, rgb[0], rgb[1], rgb[1], rgb[2], rgb[3]))

def read(source, count):
	with i2c.I2CMaster() as bus:
		print("reading %d bytes from %02x" % (count, source))
		result = bus.transaction(
			i2c.writing_bytes(address, source),
			i2c.reading(address, count))

		return result[0]

if __name__ == "__main__":
	set_led(0, [0x00, 0xFB, 0x10, 0x50])
	set_brightness(215)
	read_result = read(0x00, 26)
	print("read %d bytes" % len(read_result))
	for n in read_result:
		print("%02x" % n)
	print(" ")
