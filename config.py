DB_HOST = '127.0.0.1'
DB_USER = 'class_select'
DB_PWD = 'fjo@jio@xzm@wjq'
DB_NAME = 'class_selection'

from time import time, localtime, strftime

def isOpen():
    return strftime('%Y-%m-%d %X', localtime(time())) >= '2017-10-24 13:00'