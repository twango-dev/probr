import asyncio
import json
from datetime import datetime
from threading import Thread
from time import sleep

from language_tool_python import LanguageTool, Match
from SimpleWebSocketServer import SimpleWebSocketServer, WebSocket
from textstat import textstat

with open("./config.json") as configuration:
    config: dict = json.loads(configuration.read())

if config["heartbeat_interval"] < 10000:
    raise Exception("Heartbeat interval must be greater than 10000 milliseconds")

textstat.set_lang("en")


def match_to_dict(match: Match) -> dict:
    return {
        "ruleId": match.ruleId,
        "message": match.message,
        "replacements": match.replacements,  # The possible replacement options
        "offsetInContext": match.offsetInContext,
        "context": match.context,
        "offset": match.offset,
        "errorLength": match.errorLength,
        "category": match.category,
        "ruleIssueType": match.ruleIssueType,
        "sentence": match.sentence
    }


class WebsocketHandler(WebSocket):

    def handleConnected(self):
        print("Client Connected")
        return_json = {
            "op": 10,
            "d": {
                "heartbeat": config["heartbeat_interval"]
            }
        }
        self.sendMessage(json.dumps(return_json))

        # Heartbeat
        self.last_heartbeat = datetime.now()

        def heart_thread():
            while True:
                time_difference = (datetime.now() - self.last_heartbeat).total_seconds() * 1000
                if time_difference > config["heartbeat_interval"]:
                    self.close(4009, "Session timed out")
                    break
                else:
                    sleep(0.1)

        Thread(target=heart_thread).start()

    def handleMessage(self):
        try:
            given_json: dict = json.loads(self.data)
            opcode: int = given_json["op"]

            # Data is nullable
            data = None
            try:
                data = given_json["d"]
            except KeyError:
                pass

            if opcode == 0:

                websocket = self

                async def code_zero_thread():

                    # Unique ID is used for client processing
                    uniqueID = data["unique_id"]
                    process_language = data["process_language"]
                    message = data["message"]

                    matches_list = None
                    if process_language:
                        # Language tool takes a while to process
                        language_tool = LanguageTool("en-US")
                        print(f"Analysis sent for {message}")
                        matches: list[Match] = language_tool.check(message)
                        del language_tool

                        matches_list = []
                        for match in matches:
                            matches_list.append(match_to_dict(match))
                        print(f"Analysis complete: {matches_list}")
                        del matches

                    return_json = {
                        "op": 0,
                        "d": {
                            "unique_id": uniqueID,
                            "text_statistics": {
                                "lexicon_count": textstat.lexicon_count(message),
                                "sentence_count": textstat.sentence_count(message),
                                "syllable_count": textstat.syllable_count(message),
                                "readability": {
                                    "flesch_reading_ease": textstat.flesch_reading_ease(message),
                                    "smog_index": textstat.smog_index(message),
                                    "flesch_kincaid_grade": textstat.flesch_kincaid_grade(message),
                                    "coleman_liau_index": textstat.coleman_liau_index(message),
                                    "automated_readability_index": textstat.automated_readability_index(message),
                                    "dale_chall_readability_score": textstat.dale_chall_readability_score(message),
                                    "difficult_words": textstat.difficult_words(message),
                                    "linsear_write_formula": textstat.linsear_write_formula(message),
                                    "gunning_fog": textstat.gunning_fog(message),
                                    "text_standard": textstat.text_standard(message)
                                }
                            },
                            "language_tool": matches_list
                        }
                    }

                    websocket.sendMessage(json.dumps(return_json))

                asyncio.run(code_zero_thread())

            elif opcode == 1:
                websocket = self

                async def heartbeat():
                    websocket.last_heartbeat = datetime.now()
                    return_json = {"op": 11}
                    websocket.sendMessage(json.dumps(return_json))

                asyncio.run(heartbeat())

        except Exception as exception:
            print(exception)

    def handleClose(self):
        print(self.address, "closed")


server: SimpleWebSocketServer = SimpleWebSocketServer("", 6969, WebsocketHandler)
print("Starting websocket server")
server.serveforever()
