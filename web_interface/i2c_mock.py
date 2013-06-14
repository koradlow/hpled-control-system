#!/usr/bin/env python3
import decorator
import time
import sys, os
from random import randint
from pprint import pprint

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
	def __init__(self, address, name, led_cnt = LED_CNT):
		self.i2c_address = address
		self.name = name
		self.brightness = 0
		self.i2c_buffer = bytearray(RX_SIZE)
		self.led_cnt = led_cnt
		self.leds = []
		self.create_leds()
	
	def create_leds(self):
		for _ in range(self.led_cnt):
			self.leds.append({'led': RgbLed(), 'set':None})

	def get_led(self, index):
		return self.leds[index]
		
	def set_brightness(self, brightness):
		self.brightness = brightness
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


class RgbCoordinator(object):
	def __init__(self):
		#TODO: should store list of known addresses and check them at restart
		self.controllers = []
		self.create_mock_controllers()
		pprint(self.get_controllers())

	def scan_i2c_bus(self):
		'''
		scan a range of the I2C bus in order to find new RGBControllers,
		skip known addresses,
		add newly found RGBControllers to the local list
		'''

	# create a list of controllers that can be jsonified for the RESTful API
	def get_controllers(self):
		controller_list = []
		for item in self.controllers:
			controller_list.append( dict(
				addr = item.i2c_address, name = item.name, 
				brightness = item.brightness, leds = []))
			for idx, led in enumerate(item.leds):
				if led.get('set') == None:
					set_name = 'None'
				else:
					set_name = item.get('set').name
				controller_list[-1].get('leds', []).append( dict(
					channel = idx, set = set_name))
		return controller_list

	def get_controller(self, address):
		for controller in self.get_controllers():
			if controller['addr'] == address:
				return controller
		return None

	def create_mock_controllers(self):
		for i in range(2):
			self.controllers.append(RgbController(0x21+i, 'controller0'+str(i)))
			self.controllers[i].set_brightness(randint(0, 255))

	def test(self):
		return 3
