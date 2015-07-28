#!/bin/bash

#Source
# http://www.shellhacks.com/en/HowTo-Create-CSR-using-OpenSSL-Without-Prompt-Non-Interactive

# Option        Description
# openssl req   certificate request generating utility
# -nodes        if a private key is created it will not be encrypted
# -newkey       creates a new certificate request and a new private key
# -days         days the certificate is valid
# rsa:2048      generates an RSA key 2048 bits in size
# -keyout       the filename to write the newly created private key to
# -out          specifies the output filename
# -subj         sets certificate subject

# Field   Meaning                Example
# /C=     Country                GB
# /ST=    State                  London
# /L=     Location               London
# /O=     Organization           Global Security
# /OU=    Organizational Unit    IT Department
# /CN=    Common Name            example.com

openssl req \
    -nodes \
    -x509 \
    -newkey rsa:2048 \
    -days 365 \
    -keyout ./cert/ssh.key \
    -out ./cert/ssh.pem \
    -subj "/C=NL/ST=NH/L=Amsterdam/O=Pieter Jong/CN=pieterjong.nl"

chmod 0600 ./cert/ssh.key

ssh-keygen -y -f ./cert/ssh.key > ./cert/ssh.pub
