'use strict'

const net = require('net')
const tracker = require('./tracker')
const message = require('./message')
const Queue = require("./queue")
const fs = require('fs')

module.exports.run = (torrent, pieces) => {

    tracker.getPeers(torrent, async (peers) => {
        peers.reverse()
        for(let i = 0; i < peers.length; i ++) {
            // TODO: exclude the ip of myself
            try {
                await download(peers[i], torrent, pieces)
                if (pieces.isDone()) break
            } catch (e) {
                if (e) console.error(e)
            }
        }

        if (pieces.isDone()) {

            const filename = torrent.info.name

            pieces.received.forEach((blocks) => {
                blocks.forEach((file) => {
                    const buf = fs.readFileSync(file)
                    fs.appendFileSync(filename, buf)
                    fs.rmSync(file)
                })
            })
        }
    })
}

function download( peer, torrent, pieces ) {
    const socket = net.Socket()

    console.log("Connecting to " + peer.ip + ":" + peer.port)
    
    socket.on( 'error', () => {
        console.log("Error connection " + peer.ip + ":" + peer.port)
        socket.end()
    })
    socket.connect( peer.port, peer.ip, () => {

        console.log("Connected to " + peer.ip + ":" + peer.port)
        socket.write( message.buildHandshake( torrent ))
    })

    const workqueue = new Queue(torrent)
    return onWholeMsg(socket, msg => msgHandler(msg, socket, pieces, workqueue))
}

module.exports.download = download

function msgHandler(msg, socket, pieces, workqueue) {
    if ( isHandshakeMessage(msg) ) {
        console.log("handshake received.")
        socket.write( message.buildInterested() )
    } else {
        const m = message.parse(msg)

        if (m.id === 0) chokeHandler(socket)
        if (m.id === 1) unchokeHandler(socket, pieces, workqueue)
        if (m.id === 4) haveHandler(m.payload, workqueue)
        if (m.id === 5) bitfieldHandler(m.payload, workqueue)
        if (m.id === 7) pieceHandler(socket, m.payload, pieces, workqueue)
    }
}

function chokeHandler(socket) {
    socket.end();
}

function requestNext(socket, pieces, queue) {

    if ( pieces.isDone() || queue.empty() ) {
        socket.end()

    } else {
        let item = queue.dequeue()
        while (! pieces.needed( item.index, item.begin )) {
            item = queue.dequeue()
        }
        console.log(JSON.stringify(item))
    
        socket.write( message.buildRequest(item) )
        pieces.addRequested( item.index, item.begin, socket.remoteAddress, socket.remotePort )    
    }
}

function unchokeHandler(socket, pieces, queue) {
    queue.choked = false
    requestNext(socket, pieces, queue)
}

function isHandshakeMessage(msg) {
    return msg.length === msg.readUInt8(0) + 49 
        && msg.toString('utf8', 1, 20) === 'BitTorrent protocol'
}

function haveHandler( payload, queue ) {
    const idx = payload.readUInt32BE(0)
    queue.enqueue( idx )

    console.log("Peer has piece #" + idx)
}

function bitfieldHandler( payload, queue ) {
   
    payload.forEach((byte, i) => {
        for (let j = 0; j < 8; j++) {
            if (byte % 2) {
                queue.enqueue( i * 8 + 7 - j )
                console.log("Peer has pieces #" + (i * 8 + 7 - j))
            }
            byte = Math.floor(byte / 2)
        }
    })
}

function pieceHandler(socket, resp, pieces, workqueue) {

    const filename = "temp_" + resp.index + "_" + resp.begin
    fs.writeFileSync(filename, resp.block)

    pieces.addReceived( resp.index, resp.begin, filename )

    requestNext(socket, pieces, workqueue)
}

function onWholeMsg(socket, callback) {
    let savedBuf = Buffer.alloc(0)
    let handshake = true

    socket.on( 'data', recvBuf => {
        const len = () => {
            return handshake ? savedBuf.readUInt8(0) + 49 : savedBuf.readInt32BE(0) + 4
        }
        savedBuf = Buffer.concat([savedBuf, recvBuf])

        // Check if the entire message is received
        while (savedBuf.length >= 4 && savedBuf.length >= len() ) {
            // Return the message for processing
            callback(savedBuf.slice( 0, len() ))
            // Remove the processed message from buffer
            savedBuf = savedBuf.slice( len() )
            handshake = false
        }
    })

    return new Promise((resolve, reject) => {
        socket.on('close', () => {
            resolve()
        })

        socket.on('error', () => {
            reject()
        })
    })
}