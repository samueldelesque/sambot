from flask import Flask
from flask_restful import reqparse, abort, Api, Resource
from fuzzywuzzy import process, fuzz
from time import gmtime, strftime
# from chatterbot import ChatBot
# from chatterbot.training.trainers import ListTrainer, ChatterBotCorpusTrainer

app = Flask(__name__)
api = Api(app)

# chatbot = ChatBot("SamBot", read_only=True)
# chatbot.set_trainer(ChatterBotCorpusTrainer)
# chatbot.train("chatterbot.corpus.english")

parser = reqparse.RequestParser()
parser.add_argument('message')

context = {
    "user": False
}

class Response:
    def hello(self):
        if(context["user"] == False):
            return {"text":"Hello. What's your name?", "prompt": "context.user.name"}

        return {"text":"Hello " + context["user"].name}

    def howdy(self):
        return {"text":"I am good I guess. And you?"}

    def tellTime(self):
        return {"text":"It is " + strftime("%H:%M:%S", gmtime()) + "."}

    def dunno(self):
        return {"text":"Sorry I did not get that."}

    def setName(self, name):
        context["user"] = name
        return {"text":"Okey, " + name}

res = Response()

answers = {
    "hi": res.hello,
    "hi man": res.hello,
    "hi dude": res.hello,
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
            answer = answers[answerMatch[0]]()
            return {"answer": answer, "match": {"text": answerMatch[0], "probability": probability}}
        else:
            print "We should record this question: "
            print args.message
            # answer = chatbot.get_response(args.message)
            answer = res.dunno()
            return {"answer": answer, "match": {"text": answerMatch[0], "probability": probability}}


api.add_resource(Index, '/')
api.add_resource(Chat, '/chat')

if __name__ == "__main__":
    # app.run(debug=True)
    app.run(host='0.0.0.0', port=6020)
