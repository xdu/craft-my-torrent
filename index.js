'use strict'

const tracker = require("./tracker")
const parser = require("./torrent-parser")
const download = require("./download")
const Pieces = require("./pieces")

const torrent = parser.open( process.argv[2] )

// tracker.getPeers(torrent, (peers) => {
//      console.log("Peers : ")
//      peers.map(peer => console.log(peer.ip + ":" + peer.port))
// })
// console.log( parser.pieceLen(torrent, 0) )
// console.log( parser.blockPerPiece(torrent, 0) )
// console.log( parser.blockLen(torrent, 4, 0) )
const pieces = new Pieces(torrent)

// download.download({ip : '90.70.220.208', port: 40295}, torrent, pieces)
//     .then(() => {
//         console.log("Peer promise resolved.")
//     })
download.run(torrent, pieces)