from flask import Flask
from flask_restful import reqparse, abort, Api, Resource
from flask_cors import CORS
from fuzzywuzzy import process, fuzz
from time import gmtime, strftime
import spacy
import actions
import random
import responses
from data import answers, staticAnswers
import json

app = Flask(__name__)
CORS(app)
api = Api(app)
nlp = spacy.load('en')

parser = reqparse.RequestParser()
parser.add_argument('message')
parser.add_argument('prompt')
parser.add_argument('client_id')

conversationsFile = open("conversations.json","r")
conversations = json.load(conversationsFile)
conversationsFile.close()

tobeansweredFile = open("tobeanswered.json","r")
tobeanswered = json.load(tobeansweredFile)
tobeansweredFile.close()

# Global context
context = {
    "bot": {
        "name": "SamBot"
    }
}


# A custom function to tokenize the text using spaCy
# and convert to lemmas
def tokenizeText(text):

    # get the tokens using spaCy
    tokens = nlp(text)

    # lemmatize
    lemmas = []
    for tok in tokens:
        lemmas.append(tok.lemma_.lower().strip() if tok.lemma_ != "-PRON-" else tok.lower_)

    # remove large strings of whitespace
    while "" in lemmas:
        lemmas.remove("")
    while " " in lemmas:
        lemmas.remove(" ")
    while "\n" in lemmas:
        lemmas.remove("\n")
    while "\n\n" in lemmas:
        lemmas.remove("\n\n")

    return lemmas


def getLocalContext(client_id):
    global conversations
    try:
        conversations[client_id]
    except KeyError:
        conversations[client_id] = {
            "messages": [],
            "context": {
                "user": {
                    "name": None,
                    "age": None,
                    "isAdmin": None,
                    "attemptAuthorizeCount": 0
                }
            }
        }

    localContext = {}
    localContext.update(context)
    localContext.update(conversations[client_id]["context"])

    return localContext

class Index(Resource):
    def get(self):
        return {'status': 'ok'}

class History(Resource):
    def get(self):
        args = parser.parse_args()
        context = getLocalContext(args.client_id)
        return {"conversation": conversations[args.client_id]["messages"], "context": context}


staticAnswersKeys = {}
for answer in staticAnswers:
    staticAnswersKeys[" ".join(tokenizeText(answer))] = answer

# print(staticAnswersKeys)

class Chat(Resource):
    def post(self):
        args = parser.parse_args()
        localContext = getLocalContext(args.client_id)
        # doc = nlp(args.message)
        # sentences = [sent.string.strip() for sent in doc.sents]
        tokenKey = " ".join(tokenizeText(args.message))

        answerMatch = process.extractOne(args.message.lower(), answers.keys())
        probability = fuzz.ratio(args.message.lower(), answerMatch[0])

        staticAnswerMatch = process.extractOne(tokenKey, staticAnswersKeys.keys())
        staticAnswerProbability = fuzz.ratio(tokenKey, staticAnswerMatch[0])

        if args.prompt is not None:
            try:
                answer = getattr(actions, args.prompt)(conversations[args.client_id], localContext, args.message)
            except AttributeError:
                answer = {"text": "Invalid prompt method!", "status": "error"}

        elif(probability > 70):
            try:
                answer = getattr(responses, answers[answerMatch[0]])(conversations[args.client_id], localContext, args.message)
            except AttributeError:
                answer = {"text": "Invalid response method!", "status": "error"}

        elif(staticAnswerProbability > 60):
            answer = {"text": staticAnswers[staticAnswersKeys[staticAnswerMatch[0]]]}

        else:
            print("We should record this question: ")
            print(args.message)
            tobeansweredFile = open("tobeanswered.json","w")
            tobeanswered[args.message] = ""
            json.dump(tobeanswered, tobeansweredFile)
            tobeansweredFile.close()
            answer = responses.dunno(conversations[args.client_id], localContext, args.message)

        conversations[args.client_id]["messages"].append({"text": str(args.message), "from": "user"})
        conversations[args.client_id]["messages"].append({"text": str(answer['text']), "from": "bot"})


        conversationsFile = open("conversations.json","w")
        json.dump(conversations, conversationsFile)
        conversationsFile.close()

        return {
            "answer": answer,
            "match": {
                "text": answerMatch[0],
                "probability": probability
            },
            "context": localContext,
        }


api.add_resource(Index, '/')
api.add_resource(Chat, '/chat')
api.add_resource(History, '/history')

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=6020, debug=True)
