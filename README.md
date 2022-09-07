# torus-metadata

Metadata server is used with Tkey and CustomAuth metadata

torus-metadata serves as a simple key-value store to ellitic public private key pairs. Its function primarily serves as a bulletin board where users can submit data. In the torus ecosystem, its used to encrypt nonces which connects keys to other 'keys' allowing the linking of two accounts, without having to interact with any nodes/other participants. This allows for recovery to be setup via other logins, so users can recover one if they lose another. Illustration of the flow below:

![recovery flow for logins](https://i.imgur.com/kyFIgwq.png)


### Setting Data
```sh
$ curl -X POST -H 'content-type: application/json; charset=utf-8' -d '{"pub_key_X":"4ae6b7aeee4bee67458035023c34031dbbdf474a9054145b74ec18c557a53363","pub_key_Y":"caf88ea0f507e472220bec1fccbf9fddce1f57918de3d97933f79b09c14d7c5b","set_data":{"data":"DATA","timestamp":"6318b7af"},"signature":"MySignature","namespace":"tkey"}' localhost:5051/set

{"message":"success"}
```

### Getting Data
```sh
$ curl -H 'content-type: application/json; charset=utf-8' -d '{"pub_key_X":"4ae6b7aeee4bee67458035023c34031dbbdf474a9054145b74ec18c557a53363","pub_key_Y":"caf88ea0f507e472220bec1fccbf9fddce1f57918de3d97933f79b09c14d7c5b","set_data":{"data":{},"timestamp":"6318b877"},"signature":"w2bAg17W+pRQox9ZEjYfix0ved4lW04891wxVD0FSkObehMDe7/NsgxDRECnCAAvEmoCUOngoRFcpPywX2i4zgA=","namespace":"tkey"}' localhost:5051/get

{"message":"123"}
```

### CQLSH
```
CREATE KEYSPACE ks
    WITH replication = {'class': 'SimpleStrategy', 'replication_factor': '1'};

CREATE TABLE ks.tkey (
    key text PRIMARY KEY,
    value text);
```
