#!/usr/bin/env python3
import i2c as i2c
import decorator
import time
import sys, os

I2C_SLAVE_ADDRESS = 0x28
LED_CNT = 4
LED_CHANNELS = 4
RX_SIZE =  25
RX_RGB_LED = 0
RX_CURRENT_LIMIT = 16
RX_CURRENT_UPDATE = 20
RX_BRIGHTNESS = 21

def retry(howmany, *exception_types, **kwargs):
	timeout = kwargs.get('timeout', None) # seconds
	@decorator.decorator
	def try_it(func, *fargs, **fkwargs):
			for _ in range(howmany):
					try:
						return func(*fargs, **fkwargs)
					except exception_types as e:
						print("I/O Exception, retry %d" % _)
						exc_type, exc_obj, exc_tb = sys.exc_info()
						fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
						print(exc_type, fname, exc_tb.tb_lineno)
						if timeout is not None: time.sleep(timeout)
	return try_it


class RgbSet(object):
	def __init__(self, name="undef"):
		self.leds = []
		self.name = name

	def add_led(self, led):
		led['set'] = self.name
		self.leds.append(led)
	
	def get_leds(self):
		for led in self.leds:
			if not led['set'] == self.name:
				self.leds.remove(led) 
		return self.leds

	def get_led(self, led_id):
		return self.leds[led_id]['led']


class RgbLed(object):
	def __init__(self, current_limit=245):
		self.current_limit = current_limit
		self.r = 0
		self.g1 = 0
		self.g2 = 0
		self.b = 0
		self.current_limit_update = False

	def set_color(self, **kwargs):
		r = kwargs.get('r', None)
		g = kwargs.get('g', None)
		g1 = kwargs.get('g1', None)
		g2 = kwargs.get('g2', None)
		b = kwargs.get('b', None)

		if r is not None: self.r = r
		if g is not None: self.g1 = self.g2 = g
		if g1 is not None: self.g1 = g1
		if g2 is not None: self.g2 = g2
		if b is not None: self.b = b
	
	def get_color(self):
		return {'r':self.r, 'g1':self.g1, 'g2':self.g2, 'b':self.b, 'current_limit':self.current_limit}
 
	def set_current_limit(self, current_limit):
		self.current_limit = current_limit
		self.current_limit_update = True


class RgbController(object):
	def __init__(self, address, led_cnt = LED_CNT):
		self.i2c_address = address
		self.i2c_buffer = bytearray(RX_SIZE)
		self.led_cnt = led_cnt
		self.leds = []
		self.create_leds()
	
	def create_leds(self):
		for _ in range(self.led_cnt):
			self.leds.append({'led': RgbLed(), 'set':None})

	def get_led(self, number):
		return self.leds[number]
		
	def set_brightness(self, brightness):
		self.i2c_buffer[RX_BRIGHTNESS] = brightness
	
	def update_i2c_buffer(self):
		for idx in range(len(self.leds)):
				led = self.leds[idx].get('led', None)
				if not led:
					continue
				self.i2c_buffer[idx*LED_CHANNELS] = led.r
				self.i2c_buffer[idx*LED_CHANNELS+1] = led.g1
				self.i2c_buffer[idx*LED_CHANNELS+2] = led.g2
				self.i2c_buffer[idx*LED_CHANNELS+3] = led.b
				self.i2c_buffer[RX_CURRENT_LIMIT+idx] = led.current_limit
				if (led.current_limit_update):
					self.i2c_buffer[RX_CURRENT_UPDATE] = 0x01
					led.current_limit_update = False;

	def get_state(self):
		return self.i2c_buffer

	@retry(2, IOError, timeout=0.05)
	def update_color(self):
		self.update_i2c_buffer()
		length = bytearray(1)
		length[0] = 16 + 1
		with i2c.I2CMaster() as bus:
			bus.transaction(
				i2c.writing_bytes(self.i2c_address, 0x00),
				i2c.writing(self.i2c_address, self.i2c_buffer[0:16] + length))

	@retry(2, IOError, timeout=0.05)
	def update_limits(self):
		self.update_i2c_buffer()
		length = bytearray(1)
		length[0] = 6 + 1
		with i2c.I2CMaster() as bus:
			bus.transaction(
				i2c.writing_bytes(self.i2c_address, 0x10),
				i2c.writing(self.i2c_address, self.i2c_buffer[16:22] + length))



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
	Controller1 = RgbController(I2C_SLAVE_ADDRESS)
	Set1 = RgbSet("set1")
	Set1.add_led(Controller1.get_led(0))
	Set1.add_led(Controller1.get_led(1))
	Set1.add_led(Controller1.get_led(2))
	Set1.add_led(Controller1.get_led(3))

	cnt = 0
	Set1.get_led(0).set_current_limit(230)
	Set1.get_led(1).set_current_limit(230)
	Set1.get_led(2).set_current_limit(230)
	Set1.get_led(3).set_current_limit(230)
	
	for n in range(0, 1):
		for i in range(0, 0xFF, 1):
			try:
				print("set %d" % cnt)
				cnt+=1
				Set1.get_led(0).set_color(r=i, b=0xFF-i)
				Set1.get_led(1).set_color(g=i, b=0xFF-i)
				Set1.get_led(2).set_color(r=0xFF, b=i)
				Set1.get_led(3).set_color(r=0xFF-i, g=i, b=127)
				Controller1.update_color()
				if not (cnt % 50):
					Controller1.update_limits()
				time.sleep(0.01)
			except Exception as e:
				exc_type, exc_obj, exc_tb = sys.exc_info()
				fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
				print(exc_type, fname, exc_tb.tb_lineno)
		print(" ")

	read_result = read(0x00, 32)
	print("read %d bytes" % len(read_result))
	i = 0
	for n in read_result:
		print("%02d: %s" %(i, n))
		i = i+1
		if not (i % 5):
			print(" ")
	print(" ")
