#!/usr/bin/env python3
import quick2wire.i2c as i2c
import decorator
import time
import pprint
import sys, os
import random
from random import randint

I2C_SLAVE_ADDRESS = 0x28
RX_SIZE =  25
RX_RGB_LED = 0
RX_CURRENT_LIMIT = 16
RX_CURRENT_UPDATE = 20
RX_BRIGHTNESS = 21

def retry(howmany, *exception_types, **kwargs):
	timeout = kwargs.get('timeout', None) # seconds
	@decorator.decorator
	def tryIt(func, *fargs, **fkwargs):
			for _ in range(howmany):
					try: return func(*fargs, **fkwargs)
					except exception_types or Exception as e:
							print("I/O Exception, retry %d" % _)
							exc_type, exc_obj, exc_tb = sys.exc_info()
							fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
							print(exc_type, fname, exc_tb.tb_lineno)
							if timeout is not None: time.sleep(timeout)
	return tryIt

class LedController(object):
	def __init__(self, address, led_cnt = 4):
		self.i2c_address = address
		self.led = bytearray(RX_SIZE)
		self.led_cnt = led_cnt

	def set_led_color(self, led, **kwargs):
		if (led >= self.led_cnt):
			print("LED %d out of range" %led)
			return
	
		r = kwargs.get('r', None)
		g = kwargs.get('g', None)
		b = kwargs.get('b', None)
		
		if r is not None: self.led[led*4] = r
		if g is not None: self.led[led*4+1] = g
		if g is not None: self.led[led*4+2] = g
		if b is not None: self.led[led*4+3] = b
	
	def set_brightness(self, brightness):
		self.led[RX_BRIGHTNESS] = brightness
	
	def set_current_limit(self, led, limit):
		if (led >= self.led_cnt):
			print("LED %d out of range" %led)
			return
		self.led[RX_CURRENT_LIMIT+led] = limit
		self.led[RX_CURRENT_UPDATE] = 0x01;
	
	def get_state(self):
		return self.led
	
	@retry(2, IOError, timeout=0.05)
	def update_color(self):
		length = bytearray(1)
		length[0] = 16 + 1
		with i2c.I2CMaster() as bus:
			bus.transaction(
				i2c.writing_bytes(self.i2c_address, 0x00),
				i2c.writing(self.i2c_address, self.led[0:16] + length))

	@retry(2, IOError, timeout=0.05)
	def update_limits(self):
		length = bytearray(1)
		length[0] = 6 + 1
		with i2c.I2CMaster() as bus:
			bus.transaction(
				i2c.writing_bytes(self.i2c_address, 0x10),
				i2c.writing(self.i2c_address, self.led[16:22] + length))
				
@retry(2, IOError, timeout = 0.05)
def read(source, count):
	with i2c.I2CMaster() as bus:
		print("reading %d bytes from %02x" % (count, source))
		result = bus.transaction(
			i2c.writing_bytes(I2C_SLAVE_ADDRESS, source),
			i2c.reading(I2C_SLAVE_ADDRESS, count))

		return result[0]

def read_and_print(source, count):
	result = read(source, count)
	for n in result:
		print("%02x: %02x" %(source, n))
		source = source+1
	print(" ")

def brightness_test(controller):
	for i in range(0, 0xFF, 1):
		controller.set_brightness(i)
		controller.update_limits()
		time.sleep(0.01)

if __name__ == "__main__":

	rgb_controller_1 = LedController(I2C_SLAVE_ADDRESS)
	rgb_controller_1.set_led_color(0x00, r=0xA0, g=0xB0, b=0x10)
	rgb_controller_1.set_led_color(0x01, r=0xB0, g=0xA0, b=0xD1)
	rgb_controller_1.set_led_color(0x02, r=0xB2, g=0xA2, b=0xD2)
	rgb_controller_1.set_led_color(0x03, r=0xA0, b=0xEE)
	rgb_controller_1.set_current_limit(0x00, 235)
	rgb_controller_1.set_current_limit(0x01, 235)
	rgb_controller_1.set_current_limit(0x02, 235)
	rgb_controller_1.set_current_limit(0x03, 235)

	
	rgb_controller_1.update_color()
	rgb_controller_1.update_limits()

	cnt = 0
	for n in range(0, 0):
		for i in range(0, 0xFF, 1):
			try:
				print("set %d" % cnt)
				cnt+=1
				rgb_controller_1.set_led_color(0x00, r=i, g=0, b=0xFF-i)
				rgb_controller_1.set_led_color(0x01, r=0, g=i, b=0xFF-i)
				rgb_controller_1.set_led_color(0x02, r=0xFF, g=0, b=i)
				rgb_controller_1.set_led_color(0x03, r=0xFF-i, g=i, b=0)
				rgb_controller_1.update_color()
				if not (cnt % 50):
					rgb_controller_1.update_limits()
				time.sleep(0.01)
			except Exception as e:
				exc_type, exc_obj, exc_tb = sys.exc_info()
				fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
				print(exc_type, fname, exc_tb.tb_lineno)
		print(" ")

	brightness_test(rgb_controller_1)
	
	read_result = read(0x00, 32)
	print("read %d bytes" % len(read_result))
	i = 0
	for n in read_result:
		print("%02d: %02x" %(i, n))
		i = i+1
		if not (i % 4):
			print(" ")
	print(" ")
