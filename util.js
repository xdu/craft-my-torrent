'use strict'

const crypto = require('crypto')

let id = null

module.exports.genId = () => { 
    if (! id) {
        id = '-TA0001-' + crypto.randomBytes(6).toString('hex')
    }

    return id
}