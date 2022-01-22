'use strict'

const crypto = require("crypto")

const fs = require('fs')
const bencode = require('bencode')

module.exports.open = (filepath) => {
    return bencode.decode(fs.readFileSync( filepath ))
}

module.exports.size = (torrent) => {
    const size = torrent.info.files ? 
        torrent.info.files.map( file => file.length).reduce(
            (a, b) => a + b
        ) : torrent.info.length;

    return size
}

module.exports.infohash = (torrent) => {
    // sha1 hash length is 20 bytes
    const info = bencode.encode(torrent.info)
    return crypto.createHash('sha1').update(info).digest()
}

module.exports.BLOCK_LEN = Math.pow(2, 14)

module.exports.pieceLen = (torrent, idx) => {
    const total = this.size(torrent)
    const piece = torrent.info['piece length']

    const last = (total % piece)
    const lastPieceIdx = Math.floor(total / piece)

    return lastPieceIdx === idx ? last : piece
}

module.exports.blockPerPiece = (torrent, idx) => {
    const len = this.pieceLen(torrent, idx)
    return Math.ceil( len / this.BLOCK_LEN )
}

module.exports.blockLen = (torrent, pieceIdx, blockIdx) => {
    const len = this.pieceLen(torrent, pieceIdx)

    const lastBlockLen = len % this.BLOCK_LEN
    const lastBlockIdx = Math.floor(len / this.BLOCK_LEN)

    return blockIdx === lastBlockIdx ? lastBlockLen : this.BLOCK_LEN
}

