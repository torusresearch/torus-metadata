# torus-metadata

Metadata server is used with Tkey and CustomAuth metadata

torus-metadata serves as a simple key-value store to ellitic public private key pairs. Its function primarily serves as a bulletin board where users can submit data. In the torus ecosystem, its used to encrypt nonces which connects keys to other 'keys' allowing the linking of two accounts, without having to interact with any nodes/other participants. This allows for recovery to be setup via other logins, so users can recover one if they lose another. Illustration of the flow below:

![recovery flow for logins](https://i.imgur.com/kyFIgwq.png)



### Setting Data
```sh
$ curl -X GET --data '{ "verifier": "test", "verifier_id": "test@gmail.com", "data": "123", "signature": "SignatureHexString" }' localhost:5051/set
{"message":"success"}
```

### Getting Data
```sh
$ curl -X GET --data '{ "verifier": "test", "verifier_id": "test@gmail.com" }' localhost:5051/get
{"message":"123"}
```
