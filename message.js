'use strict'

const torrentParser = require("./torrent-parser")
const util = require("./util")

module.exports.buildHandshake = torrent => {

    let buf = Buffer.alloc(68)
    //pstrlen
    buf.writeUInt8(19, 0)
    //pstr
    buf.write('BitTorrent protocol', 1)
    //reserved
    buf.writeUInt32BE(0, 20)
    buf.writeUInt32BE(0, 24)
    // info hash
    torrentParser.infohash(torrent).copy(buf, 28)
    // peerid
    buf.write(util.genId(), 48)

    return buf
}

module.exports.buildKeepalive = () => {
    Buffer.alloc(4)
}

module.exports.buildChoke = () => {
    
}

module.exports.buildInterested = () => {
    const buf = Buffer.alloc(5)

    buf.writeUInt32BE(1, 0)
    buf.writeUInt8(2, 4)

    return buf
}

module.exports.buildRequest = (payload) => {
    const buf = Buffer.alloc(17)
    
    // <len=0013><id=6><index><begin><length>
    buf.writeUInt32BE(13, 0)
    buf.writeUInt8(6, 4)
    buf.writeUInt32BE(payload.index, 5)
    buf.writeUInt32BE(payload.begin, 9)
    buf.writeUInt32BE(payload.length, 13)

    return buf
}
/*
 * keep-alive: <len=0000>
 * choke: <len=0001><id=0>
 * unchoke: <len=0001><id=1>
 * interested: <len=0001><id=2>
 * not interested: <len=0001><id=3>
 * have: <len=0005><id=4><piece index>
 * bitfield: <len=0001+X><id=5><bitfield>
 * request: <len=0013><id=6><index><begin><length>
 * piece: <len=0009+X><id=7><index><begin><block>
 * cancel: <len=0013><id=8><index><begin><length>
 * port: <len=0003><id=9><listen-port>
 * 
 */
module.exports.parse = (msg) => {

    const id = msg.length > 4 ? msg.readInt8(4) : null
    let payload = msg.length > 5 ? msg.slice(5) : null

    if (id === 6 || id ===7 || id ===8) {
        const rest = payload.slice(8)
        payload = {
            index: payload.readInt32BE(0),
            begin: payload.readInt32BE(4)
        }
        payload[id === 7 ? 'block' : 'length'] = rest
    }

    return {
        size: msg.readInt32BE(0),
        id: id,
        payload: payload
    }
}