import requests

def hello(conversation, localContext, text):
    if localContext["user"]["name"] is None:
        return {"text":"Hello. What's your name?", "prompt": "setUserName"}

    return {"text":"Hello " + localContext["user"]["name"]}

def authPrompt(conversation, localContext, text):
    return {"text":"Iniating authentication request... \n What's your passphrase?", "prompt": "authenticate"}

def howold(conversation, localContext, text):
    return {"text": "Me? I am just a few days old."}

def howdy(conversation, localContext, text):
    return {"text":"I am good I guess. And you?", "prompt": "setUserMood"}

def tellTime(conversation, localContext, text):
    return {"text":"It is " + strftime("%H:%M:%S", gmtime()) + "."}

def tellName(conversation, localContext, text):
    return {"text":"My name is " + context['bot']['name'] + "."}

def tellUserName(conversation, localContext, text):
    if localContext["user"]["name"] is None:
        return {"text":"I don't know, what is your name?", "prompt": "setUserName"}
    return {"text":"Your name is " + localContext["user"]["name"] + ". (But you knew that I hope!)"}

def lolGif(conversation, localContext, text):
    r = requests.get('http://api.giphy.com/v1/gifs/random?api_key=dc6zaTOxFJmzC&tag=lol')
    if(r.status_code == 200):
        try:
            return {"text": "<img src='"+r.json()["data"]["image_url"]+"'/>"}
        except ValueError:
            return {"text":"Cry out loud."}

    return {"text":"Laugh out loud."}

def yesOrNo(conversation, localContext, text):
    if random.choice([True, False]):
        return {"text":"Yes."}
    return {"text":"No."}

def dunno(conversation, localContext, text):
    return {"text":"Sorry I did not get that."}

def nothing(conversation, localContext, text):
    return {}

def setName(name):
    context["user"] = name
    return {"text":"Okey, " + name}
