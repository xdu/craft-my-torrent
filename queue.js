'use strict'

const parser = require('./torrent-parser')

module.exports = class {

    constructor( torrent ) {
        this.torrent = torrent
        this.choked  = true
        this.items = []
    }

    length ( idx ) {
        return parser.pieceLen(this.torrent, idx)
    }

    enqueue( idx ) {

        const len = parser.pieceLen(this.torrent, idx)
        const num = parser.blockPerPiece(this.torrent, idx)

        let offset = 0
        for (let i = 0; i < num; i++ ) {
            const blockLen = parser.blockLen(this.torrent, idx, i)
            
            this.items.push({
                index: idx,
                begin: offset,
                length: blockLen
            })

            offset = offset + blockLen
        }
    }

    dequeue() {
        return this.items.length ? this.items.shift() : null
    }

    empty() {
        return this.items.length === 0
    }
}
