'use strict'

const parser = require("./torrent-parser")

module.exports = class {

    constructor(torrent) {

        const numPieces = torrent.info.pieces.length / 20;
        const t = new Array(numPieces).fill(null)
        const tt = t.map(( _, i ) => {
            const numBlocks = parser.blockPerPiece(torrent, i)
            return new Array(numBlocks).fill("")
        })

        this.requested = tt
        this.received  = tt.slice()
    }

    addRequested( pieceIdx, offset, address, port ) {
        const blockIdx = offset / parser.BLOCK_LEN
        this.requested[pieceIdx][blockIdx] = address + ":" + port
    }

    addReceived( pieceIdx, offset, filename ) {
        const blockIdx = offset / parser.BLOCK_LEN
        this.received[pieceIdx][blockIdx] = filename
    }
    
    needed( pieceIdx, offset ) {
        if (this.requested.every(blocks => blocks.every((i) => i !== ""))) {
            // Copy received to requested
            this.requested = this.received.slice()
        }

        const blockIdx = offset / parser.BLOCK_LEN
        return ! this.requested[pieceIdx][blockIdx]
    }

    isDone() {
        return this.received.every(blocks => blocks.every((i) => i !== ""))
    }
}