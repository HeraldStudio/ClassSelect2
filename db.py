from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.ext.declarative import declarative_base
from config import *

Base = declarative_base()
engine = create_engine('mysql+pymysql://%s:%s@%s/%s?charset=utf8' %
                       (DB_USER, DB_PWD, DB_HOST, DB_NAME), echo=False, pool_size=500, pool_recycle=100)

class User(Base):
    __tablename__ = 'user'
    uid = Column(Integer, primary_key=True)
    cardnum = Column(String(128), nullable=False)
    schoolnum = Column(String(128), nullable=False)
    name = Column(String(256), nullable=False)
    token = Column(String(256), nullable=False)

class Class(Base):
    __tablename__ = 'class'
    cid = Column(Integer, primary_key=True)
    name = Column(String(256), nullable=False)
    gid = Column(Integer, nullable=False)
    desc = Column(String(1024), nullable=False)
    pic = Column(String(1024), nullable=False)
    capacity = Column(Integer, nullable=False)

class ClassGroup(Base):
    __tablename__ = 'class_group'
    gid = Column(Integer, primary_key=True)
    name = Column(String(256), nullable=False)
    max_select = Column(Integer, default=0)
    ggid = Column(Integer, nullable=True)

class ClassGroupGroup(Base):
    __tablename__ = 'class_group_group'
    ggid = Column(Integer, primary_key=True)
    name = Column(String(256), nullable=False)
    max_select = Column(Integer, default=0)

class Selection(Base):
    __tablename__ = 'selection'
    sid = Column(Integer, primary_key=True)
    uid = Column(Integer, nullable=False)
    cid = Column(Integer, nullable=False)
    gid = Column(Integer, nullable=False)
    ggid = Column(Integer, nullable=True)
    time = Column(String(256), nullable=False)

class Log(Base):
    __tablename__ = 'log'
    lid = Column(Integer, primary_key=True)
    uid = Column(Integer, nullable=False)
    cid = Column(Integer, nullable=False)
    operation = Column(String(256), nullable=False)
    time = Column(String(256), nullable=False)

if __name__ == '__main__':
    Base.metadata.create_all(engine)
    print('Tables created.')
