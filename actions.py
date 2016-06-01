import re
import config

def setUserName(conversation, localContext, text):
    conversation["context"]["user"]["name"] = text
    return {"text": "Nice to meet you " + text + "."}

def setUserMood(conversation, localContext, text):
    if re.search(r'(good|great|awesome|well)', text):
        conversation["context"]["user"]["mood"] = "good"
        return {"text": "Good to hear."}

    if re.search(r'(ok|fine|not bad)', text):
        conversation["context"]["user"]["mood"] = "fine"
        return {"text": "Sorry to hear that."}

    if re.search(r'(bad|sad|awful|tired|down)', text):
        conversation["context"]["user"]["mood"] = "bad"
        return {"text": "Sorry to hear that."}

    return {"text": "Whatever."}

def authenticate(conversation, localContext, text):
    if text == config.adminPassword:
        conversation["context"]["isAdmin"] = True
        return {"text": "You are now authorized."}
    else:
        conversation["context"]["attemptAuthorizeCount"] += 1
        if conversation["context"]["attemptAuthorizeCount"] >= 2:
            return {"text": "Too many failed attemps."}
        return {"text": "Wrong password.", "prompt": "auth.password"}
