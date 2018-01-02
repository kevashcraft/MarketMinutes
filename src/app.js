import args from 'args'
import config from './config'
import symbolsAll from './symbols'

import axios from 'axios'
import moment from 'moment'
import jsonfile from 'jsonfile'

args
  .option('symbol', 'The stock symbol to retrieve')
  .option('all', 'Retrieve all of the listed symbols', false)
  .option('interval', 'The interval to retrieve (1min, 5min, 15min, 30min, 60min)')
  .option('full', 'Retrieve all of the available data', false)

const flags = args.parse(process.argv)

const TSI = 'https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY'

var interval = '1min'
var outputsize = 'full'
var symbols = symbolsAll
var successful = []
var unsuccessful = {}
var rerror = []
var nodata = []
var retryTimes = 0
var retryTimesMax = 5

// retrieving individual symbols
if (!flags.all) {
  let symbol = flags.symbol
  interval = flags.interval || '1min'
  outputsize = flags.full ? 'full' : 'compat'
  symbols = [ symbol ]
}

getPrices()

async function getPrices () {
  let symbol = symbols.shift().toUpperCase()
  console.log('Retrieving ', symbol)

  let url = TSI +
    '&symbol=' + symbol +
    '&interval=' + interval +
    '&outputsize=' + outputsize +
    '&apikey=' + config.apikey

  try {
    let response = await axios.get(url)
    let keys = Object.keys(response.data)
    // let meta = response.data[keys[0]]

    let prices = response.data[keys[1]]
    let priceKeys = Object.keys(prices)
    let length = priceKeys.length

    let firstPrice = priceKeys[length - 1]
    let lastPrice = priceKeys[0]

    let data = {
      symbol: symbol,
      prices: prices
    }

    let filename = './data/' +
      symbol +
      ': ' + firstPrice +
      ' to ' + lastPrice +
      ' - ' + moment().unix() +
      ' - ' + length +
      '.json'

    try {
      await jsonfile.writeFile(filename, data)
      console.log('filename', filename)
    } catch (e) {
      if (retryTimes < retryTimesMax) {
        retryTimes++
        console.log('JSON Error!', retryTimes)
        symbols.unshift(symbol)
        setTimeout(getPrices, 15000)
        return
      } else {
        retryTimes = 0
        console.log('Error!')
        unsuccessful[symbol] = e
        nodata.push(symbol)
      }
    }

    successful.push(symbol)
    console.log('Retrieved ' + symbol + ' with ' + length + ' lines')
    retryTimes = 0
  } catch (e) {
    if (retryTimes < retryTimesMax) {
      retryTimes++
      console.log('Retrieval Error!', retryTimes)
      symbols.unshift(symbol)
      setTimeout(getPrices, 15000)
      return
    } else {
      retryTimes = 0
      console.log('Error!')
      rerror.push(symbol)
      unsuccessful[symbol] = e
    }
  }

  if (symbols.length) {
    console.log(symbols.length + ' remaining')
    setTimeout(getPrices, 5000)
  } else {
    console.log('unsuccessful', unsuccessful)
    let uns = Object.keys(unsuccessful)
    console.log('uns', uns)
    console.log('nodata', nodata)
    console.log('rerror', rerror)
  }
}
