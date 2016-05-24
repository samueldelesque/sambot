from flask import Flask
from flask_restful import reqparse, abort, Api, Resource
from fuzzywuzzy import process, fuzz
from time import gmtime, strftime

app = Flask(__name__)
api = Api(app)

parser = reqparse.RequestParser()
parser.add_argument('message')

context = {
    "user": "Unknown person"
}

class Response:
    def hello(self):
        return "Hello " + context["user"]

    def howdy(self):
        return "I am good I guess. And you?"

    def tellTime(self):
        return "It is " + strftime("%H:%M:%S", gmtime()) + "."

    def dunno(self):
        return "Sorry I did not get that."

    def setName(self, name):
        context["user"] = name
        return "Okey, " + name

res = Response()

answers = {
    "hi": res.hello,
    "hello": res.hello,
    "hay": res.hello,
    "salutations": res.hello,
    "hola": res.hello,
    "howdy": res.howdy,
    "how are you": res.howdy,
    "how goes": res.howdy,
    "what's up": res.howdy,
    "how do you do?": res.howdy,
    "what time is it?": res.tellTime,
}

class Index(Resource):
    def get(self):
        return {'status': 'ok'}

class Chat(Resource):
    def post(self):
        args = parser.parse_args()

        answerMatch = process.extractOne(args.message, answers.keys())
        probability = fuzz.ratio(args.message, answerMatch[0])

        if(probability > 70):
            print "Hay answer"
            return {"response": answers[answerMatch[0]](), "original_text": args.message, "match": answerMatch[0], "probability": probability}
        else:
            print "We should record this question: "
            print args.message
            return {"response": res.dunno(), "original_text": args.message, "match": answerMatch[0], "probability": probability}


api.add_resource(Index, '/')
api.add_resource(Chat, '/chat')

if __name__ == "__main__":
    app.run(debug=True)
