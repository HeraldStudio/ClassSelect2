DB_HOST = '139.129.4.219'
DB_USER = 'class_select'
DB_PWD = 'fjo@jio@xzm@wjq'
DB_NAME = 'class_selection'

from time import time, localtime, strftime

open = False

def isOpen():
    global open
    if open == True:
        return True
    open = strftime('%Y-%m-%d %X', localtime(time())) >= '2017-12-07 12:00'
    return open

closed = False

def isClosed():
    global closed
    if closed == True:
        return True
    closed = strftime('%Y-%m-%d %X', localtime(time())) >= '2017-12-08 14:00'
    return closed