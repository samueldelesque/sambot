var express = require('express'),
    errorhandler = require('errorhandler'),
    bodyParser = bodyParser = require('body-parser'),
    njwt = require('njwt'),
    fs = require('fs'),
    csvParser = require('csv-parse'),
    jwt = require('express-jwt'),
    url = require('url'),
    rp = require('request-promise'),
    crypto = require('crypto'),
    mongoose = require('mongoose'),
    _ = require('lodash'),

    natural = require('natural'),
    chrono = require('chrono-node'),
    moment = require('moment'),
    tokenizer = new natural.TreebankWordTokenizer(),
    classifier = new natural.LogisticRegressionClassifier(),
    tim = require('tinytim').tim,
    Q = require('q')

// Load up config
global.config = require('./config/server.js')(process.env.ENV)

// Start up express App
console.log('Starting myAI API')
var api = express()

if(process.env.ENV === 'dev'){
  api.use(errorhandler())
}

var commonWords = []
fs.readFile('./data/common-words.csv', function(err, file){
  if(err) return console.log('Failed to load common words.')
  csvParser(file, {delimiter: ','}, function(err,data){
    commonWords = _.map(data, function(d){return d[0]})
  })
})
var punctuation = ['.','?',',','!',';',':']
var countriesToCities = require('./data/countriesToCities.json')
var countries = []
_.forEach(countriesToCities, function(country, k){
  countriesToCities[k.toLowerCase()] = _.map(country, function(c){return c.toLowerCase()})
  countries.push(k.toLowerCase())
})

function conjugate(word, subject, tense){
  return word[subject][word.tense.indexOf(tense)]
}
var words = {
  pronouns: {
    tense: ['subject','object', 'possessive adj','possessive','reflexive'],
    me: ['i', 'me', 'my', 'mine', 'myself'],
    you: ['you','you','your','yours','yourself'],
    he: ['he', 'him', 'his', 'his', 'himself'],
    she: ['she', 'her','her', 'hers', 'herself'],
    it: ['it','it', 'its', 'herself'],
    we: ['we', 'us', 'our', 'ours', 'ourselves'],
    yous: ['you','you','your','yours','yourselves'],
    they: ['they','them','their','theirs','themselves'],
  },
  verbs: {
    be: {
      tense: ['present','past','perfect'],
      me: ['am', 'was','been'],
      you: ['are','were','been'],
      he: ['is', 'was','been'],
      she: ['is', 'was','been'],
      it: ['is','was','been'],
      we: ['are', 'were','been'],
      yous: ['are','were','been'],
      they: ['are','were','been'],
    }
  },
  subjects: {
    possessive:{
      i: 'your',
      you: 'my',
      he: 'his',
      she: 'her',
      it: 'his',
      we: 'our',
      they: 'their',
    },
    subjectWithBe:{
      i: 'you are',
      you: 'I am',
      he: 'he is',
      she: 'she is',
      it: 'it is',
      we: 'we are',
      they: 'they are',
    },
  }
}

// Connect to DBs
mongoose.connect(config.dbHost, config.mainDb)

// Parse x-form and json bodies, and accept jwt token auth
api.use(bodyParser.json())
api.use(bodyParser.urlencoded({ extended: false }))
api.use(jwt({
  secret: config.secretKey,
  credentialsRequired: false,
  getToken: function fromHeaderOrQuerystring (req) {
    if(req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
        return req.headers.authorization.split(' ')[1];
    }
    else if(req.query && req.query.access_token) {
      return req.query.access_token;
    }
    return null;
  }
}))

var refs = {
  me: {
    name: 'Sam (well, his AI.v'+ config.version +')',
    age: function(){
      return '25 years old'
    },
    location: 'New York, United States',
    units: 'metric',
  },
  User: {
    name: 'Roger',
    age: function(){
      return '20 years old'
    },
    units: 'metric',
  },
  Units: {
    metric: {
      temperature: '°C',
    }
  },
  Weather: {
    forecast: function(phrase){
      var location = phrase.location
      var weatherUrl = 'http://api.openweathermap.org/data/2.5/weather?q=' + encodeURIComponent(location) + '&APPID=' + config.weatherAPIKey+ '&units=' + refs.User.units
      return rp({uri: weatherUrl, json: true})
        .then(function(data){
          var forecast = {temperature: data.main.temp, location: location}
          return forecast
        })
        .catch(function(err){
          console.log('Failed to fetch weather...', err)
        })
    }
  }
}

var training = [
  {
    identifier: 'default',
    documents: [
      'abcdefghijklmnopqrstuvwxyz '
    ],
    response: {text: 'Sorry, I do not know what you mean by that.'},
    action: 'unknownPhrase'
  },
  {
    identifier: 'ageRequest',
    documents: [
      'how old qq qq?',
    ],
    parseInput: ['subject'],
    response: {text: '{{subject}} {{age}}',
    data: {
      subject: {ref: 'Subject', conjugate: 'subject'},
      age: {ref: 'sub', field: 'age', default: 'very young (for a master jedi)'}}
    },
  },
  {
    identifier: 'nameRequest',
    documents: [
      'What\'s qq name?',
    ],
    parseInput: ['subject'],
    response: {text: '{{subject}} name is {{name}}',
    data: {
      subject: {ref: 'Subject', conjugate: 'possessive'},
      name: {ref: 'sub', field: 'name', default: 'not known'}
    }},
  },
  {
    identifier: 'userGreeting',
    documents: [
      'hello',
      'hi',
      'hay',
      'greetings',
      'good morning',
      'good afternoon',
    ],
    response: {text: 'Hi {{name}}', data: {name: {ref: 'User', field: 'name', default: 'mate'}}}
  },
  {
    identifier: 'userGreetingWithStatus',
    documents: [
      'how are you?',
      'what\'s up?',
      'what\'s up qqqq?',
      'how have you been?',
      'how are you doing?',
    ],
    response: {text: 'Hi {{name}} - I am great, how are you?', data: {name: {ref: 'User', field: 'name', default: 'mate'}}}
  },
  {
    identifier: 'weatherRequest',
    documents: [
      'how cold is it?',
      'how hot is it?',
      'what is the temperature?',
      'do i need an umbrella?',
      'is it sunny today?',
      'is the sun shining?',
      'is it raining?',
      'how cold is it in qqqq?',
      'is it sunny today in qqqq?',
      'is the sun shining in qqqq?',
      'is it raining in qqqq?',
    ],
    parseInput: ['time', 'location'],
    response: {
      text: 'It is {{forecast.temperature}}{{units.temperature}} in {{location}}',
      data: {
        location: {ref: 'location', default: 'New York'},
        time: {ref: 'time', default: 'Today'},
        forecast: {ref: 'Weather', field: 'forecast', default: 'very cold'},
        units: {ref: 'Units', default: {temperature: '°C'}},
      }
    }
  },
]

training.forEach(function(phrase){
  phrase.documents.forEach(function(doc){
    classifier.addDocument(doc, phrase.identifier)
  })
})
classifier.train()

function classify(text){
  var phrase = _.first(_.filter(training, function(test){return ~test.documents.indexOf(text)}))
  if(!phrase) phrase = _.first(_.filter(training, function(e){return e.identifier === classifier.classify(text)}))
  phrase.originalText = text
  return phrase
}

function extractLocation(text){
  text = text.toLowerCase()
  var country = 'united states'
  _.forEach(countries, function(c){if(c&&~text.indexOf(c)){country = c}})
  var city = _.filter(countriesToCities[country], function(city){
    var cityRegex = new RegExp('(^|[ ]+)' + city + '($|[ ]+)','gi');
    return text.match(cityRegex)
  })
  if(city.length > 0){
    return _.first(city)+', '+country
  }
  return null
}

function extractSubject(words){
  var pronouns = {
    type: ['subject','object', 'possessive adj','possessive','reflexive'],
    me: ['i', 'me', refs.me.name, 'mine', 'myself'],
    you: ['you','you','your','yours','yourself'],
    he: ['he', 'him', 'his', 'his', 'himself'],
    she: ['she', 'her','her', 'hers', 'herself'],
    it: ['it','it', 'its', 'herself'],
    we: ['we', 'us', 'our', 'ours', 'ourselves'],
    yous: ['you','you','your','yours','yourselves'],
    they: ['they','them','their','theirs','themselves'],
  }

  var s1 = ['i','you','he','she','it','we','they'],
      subs1 = _.intersection(words, s1),
      s2 = ['me','you','he','she','it','we','they'],
      subs2 = _.intersection(words, s2)
      s3 = ['my','your','his','her','his','our','their'],
      subs3 = _.intersection(words, s2)

    if(subs3.length > 0)
      return s1[s3.indexOf(_.first(subs3))]
    if(subs2.length > 0)
      return s1[s2.indexOf(_.first(subs2))]
    if(subs1)
      return _.first(subs1)
  return null
}

function extractInputData(phrase){
  console.log('extractInputData')
  var docWords = _.uniq(_.flatten(_.map(phrase.documents, function(doc){return tokenizer.tokenize(doc)})))
      originalWords = tokenizer.tokenize(phrase.originalText),
      phrase.inputWords = _.difference(originalWords, docWords)

  if(phrase.parseInput && ~phrase.parseInput.indexOf('subject'))
    phrase.subject = extractSubject(phrase.inputWords)

  if(phrase.parseInput && ~phrase.parseInput.indexOf('time'))
    phrase.time = chrono.parseDate(phrase.originalText)

  if(phrase.parseInput && ~phrase.parseInput.indexOf('location'))
    phrase.location = extractLocation(phrase.originalText) || refs.User.location || refs.me.location

/*
    if(d.$or && typeof d.$or === 'object'){
      var possibles = d.$or.length, i=0
      for(i;i<=possibles;i++){
        var data = arguments.callee(d.$or[i])
        if(i == possibles || (data && data !== '[not known]')) return data
      }
    }*/

  return phrase
}

function addContextData(phrase){
  console.log('Fetching contextual data')
  var result = Q.defer()
  if(!phrase.response.data) phrase.response.data = []
  var dataKeys = Object.keys(phrase.response.data), sub = refs.User
  Q.all(_.map(phrase.response.data, function(d){
    if(d.ref && (d.ref === 'me' || (d.ref === 'sub' && phrase.subject === 'you')))
      sub = refs.me


    // warnings
    if(d.ref === 'Subject'){
      console.log('Subject', d.conjugate, phrase.subject)
    }

    if(!d.ref)
      return d

    // Time, Location, Units, and Subject nouns
    else if(d.ref === 'time')
      return moment(phrase.time).format('dddd')
    else if(d.ref === 'location')
      return phrase.location
    else if(d.ref === 'Units')
      return refs.Units[refs.User.units]
    else if(d.ref === 'Subject' && d.conjugate && phrase.subject)
      return conjugate(words.pronouns, phrase.subject, d.conjugate)

    // User type of refs (you becomes me, me you)
    else if(d.ref === 'sub')
      if(typeof sub[d.field] === 'function')
        return sub[d.field](phrase)
      else if(sub[d.field])
        return sub[d.field]
      else
        return 'not familiar to me'

    // Any other object types
    else if(refs[d.ref] && d.field)
      if(typeof refs[d.ref][d.field] === 'function')
        return refs[d.ref][d.field](phrase)
      else 
        return refs[d.ref][d.field]

    // Show default value
    else if(d.default)
      return d.default
    else
      return '[not known]'
  }))
  .then(function(data){
    console.log('Appending data to phrase')
    phrase.data = {}
    _.forEach(data, function(d, i){
      phrase.data[dataKeys[i]] = d
    })
    result.resolve(phrase)
  })
  return result.promise
}

function formatResponse(phrase){
  console.log('Formatting response', phrase.response.text, phrase.data)
  return {
    response: tim(phrase.response.text, phrase.data),
    // classifications: phrase.classifications,
    // data: phrase.data,
  }
}


api.post('/talk', function(req, res){
  if(!req.body.message) return res.send({response: ''})

  var phrase = classify(req.body.message)

  Q(phrase)
    .then(extractInputData)
    .then(addContextData)
    .then(formatResponse)
    .then(function(r){res.send(r)})
})

// Default 404 routes
api.get('*', function(req, res){res.status(404).send({msg: 'Page not found', error: 'notfound'})})
api.post('*', function(req, res){res.status(404).send({msg: 'Page not found', error: 'notfound'})})
api.put('*', function(req, res){res.status(404).send({msg: 'Page not found', error: 'notfound'})})
api.delete('*', function(req, res){res.status(404).send({msg: 'Page not found', error: 'notfound'})})

// Initialize server
var server = api.listen(config.apiPort, function () {
  console.log('myAI API listening at http://%s:%s', 
    (server.address().address !== '::' ? server.address().address : 'localhost'),
    config.apiPort
  )
})
