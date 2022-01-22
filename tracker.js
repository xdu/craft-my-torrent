'use strict'

const dgram = require('dgram')
const Buffer = require('buffer').Buffer
const URL = require('url').URL
const http = require( 'http' )
const bencode = require('bencode')

const crypto = require("crypto")

const util = require("./util")
const torrentParser = require("./torrent-parser")

module.exports.getPeers = (torrent, callback) => {
    const url = torrent.announce.toString("utf8")

    if ( url.startsWith('udp') ) {
        getPeersUdp( url, torrent, callback )
    } else {
        getPeersHttp( url, torrent, callback )
    }
    
}

function getPeersHttp( announce, torrent, callback ) {

    const url = new URL( announce )

    url.searchParams.append('numwant', 50)
    url.searchParams.append('uploaded', 0)
    url.searchParams.append('downloaded', 0)
    url.searchParams.append('left', torrentParser.size(torrent))
    url.searchParams.append('event', 'started')
    url.searchParams.append('compact', 1)
    url.searchParams.append('peer_id', util.genId())
    url.searchParams.append('port', 6881)

    let s = url.toString() + "&info_hash="
    torrentParser.infohash(torrent).forEach(char => {
        if (char === 46 || char === 45 || char === 95
            || (char >= 48 && char <= 57) 
            || (char >= 97 && char <= 122)
            || (char >= 65 && char <= 90)) {
                s = s + String.fromCharCode(char)
            } else {
                let pad = "0" + char.toString(16).toUpperCase()
                s = s + "%" + pad.slice(-2)
            }
    });

    // Announcement response
    let announceResp = {}

    // Make http request
    http.get(s, (res) => {

        // DO NOT SET ENCODING, OTHERWISE CHUNK WILL BE CONVERTED TO STRING
        let raw = []
        res.on( 'data', (chunk) => {
            raw.push(chunk)
        })

        res.on( 'end', () => {
            if ( res.statusCode == 200 ) {

                announceResp = bencode.decode( Buffer.concat(raw) )
                let peers = parsePeers(announceResp.peers)

                callback( peers )
            }
        })
    })
}

function encodeInfoHash( infohash ) {
    let param = ''
    infohash.forEach(c => param = param + '%' + c.toString(16))
    return param
}

function getPeersUdp(url, torrent, callback) {

    const socket = dgram.createSocket('udp4')
    

    udpSend(socket, buildConnReq(), url)

    socket.on('error', erro => {
        if (erro) {
            console.log(erro)
        }
    })

    socket.on('message', response => {
        if (respType(response) === 'connect') {

            const connResp = parseConnResp(response)
            console.log(connResp)

            const announceReq = buildAnnounceReq(connResp.connectionId, torrent)
            udpSend(socket, announceReq, url)

        } else if (respType(response) === 'announce') {

            const announceResp = parseAnnounceResp(response)
            callback(announceResp.peers)

        }
    })

}

function udpSend(socket, message, rawUrl, callback = () => { }) {

    const url = new URL(rawUrl)
    console.log("Sending message to " + url.hostname + ":" + url.port)

    socket.send(message, 0, message.length, url.port, url.hostname, (err) => {
        if (err) console.log(err)
    })

}

function respType(resp) {

    const action = resp.readUInt32BE(0)

    if (action === 0) return 'connect'
    if (action === 1) return 'announce'

}

function buildConnReq() {

    const buf = Buffer.alloc(16)

    buf.writeUInt32BE(0x417, 0)
    buf.writeUInt32BE(0x27101980, 4)

    buf.writeUInt32BE(0, 8)

    crypto.randomBytes(4).copy(buf, 12)
    return buf
}

function parseConnResp(resp) {
    return {
        action: resp.readUInt32BE(0),
        transactionid: resp.readUInt32BE(4),
        connectionId: resp.slice(8)
    }
}

function buildAnnounceReq(connId, torrent, port = 6881) {
    const buf = Buffer.allocUnsafe(98)

    // connection id
    connId.copy(buf, 0)
    // action
    buf.writeUInt32BE(1, 8)
    // transaction id
    crypto.randomBytes(4).copy(buf, 12)
    // info hash
    torrentParser.infohash(torrent).copy(buf, 16)
    // peer id
    util.genId().copy(buf, 36)
    // downloaded
    Buffer.alloc(8).copy(buf, 56)
    // left
    buf.writeBigUInt64BE( torrentParser.size(torrent), 64)
    // uploaded
    Buffer.alloc(8).copy(buf, 72)
    // event
    buf.writeUInt32BE(0, 80)
    // ip address
    buf.writeUInt32BE(0, 84)
    // key
    crypto.randomBytes(4).copy(buf, 88)
    // num want
    buf.writeInt32BE(-1, 92)
    // port
    buf.writeUInt16BE(port, 96)

    return buf
}

function parseAnnounceResp(resp) {

    function group(str, size) {
        let groups = []

        for (let i = 0; i < str.length; i += size) {
            groups.push(str.slice(i, i + size))
        }

        return groups
    }

    return {
        action: resp.readUInt32BE(0),
        transactionId: resp.readUInt32BE(4),
        interval: resp.readUInt32BE(8),
        leechers: resp.readUInt32BE(12),
        seeders: resp.readUInt32BE(16),
        peers: group(resp.slice(20), 6).map(addr => {
            return {
                ip: addr.slice(0, 4).join("."),
                port: addr.readUInt16BE(4)
            }
        })
    }
}

function parsePeers(str, size = 6) {

    let groups = []
    for (let i = 0; i < str.length; i += size) {
        groups.push(str.slice(i, i + size))
    }

    return groups.map(addr => {
        return {
            ip: addr.slice(0, 4).join("."),
            port: addr.readUInt16BE(4)
        }
    })
}