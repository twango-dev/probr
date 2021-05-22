import asyncio
import json
from datetime import datetime
from threading import Thread
from time import sleep

from language_tool_python import LanguageTool, Match
from sentence_splitter import SentenceSplitter
from SimpleWebSocketServer import SimpleWebSocketServer, WebSocket
from textstat import textstat

with open("./config.json") as configuration:
    config: dict = json.loads(configuration.read())

if config["heartbeat_interval"] < 10000:
    raise Exception("Heartbeat interval must be greater than 10000 milliseconds")

splitter = SentenceSplitter(language="en")
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


def list_map(input_list: list, function) -> list:
    mapped = map(lambda x: function(x), input_list)
    return list(mapped)


class WebsocketHandler(WebSocket):

    def handleConnected(self):
        print(f"Client Connected from {self.address}")
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

                        matches_list = []
                        for match in matches:
                            matches_list.append(match_to_dict(match))
                        print(f"Analysis complete: {matches_list}")

                    sentences: list = splitter.split(text=message)

                    return_json = {
                        "op": 0,  # Opcode 1
                        "d": {
                            "unique_id": uniqueID,
                            "text_statistics": {
                                "lexicon_count": textstat.lexicon_count(message),
                                "lexicon_count_ps": list_map(sentences, textstat.lexicon_count),
                                "syllable_count": textstat.syllable_count(message),
                                "syllable_count_ps": list_map(sentences, textstat.syllable_count),
                                "sentences": sentences,
                                "sentence_count": len(sentences),
                                "readability": {
                                    "flesch_reading_ease": {
                                        "score": textstat.flesch_reading_ease(message),
                                        "sps": list_map(sentences, textstat.flesch_reading_ease)
                                    },
                                    "smog_index": {
                                        "score": textstat.smog_index(message)
                                    },
                                    "flesch_kincaid_grade": {
                                        "score": textstat.flesch_kincaid_grade(message),
                                        "sps": list_map(sentences, textstat.flesch_kincaid_grade)
                                    },
                                    "coleman_liau_index": {
                                        "score": textstat.coleman_liau_index(message),
                                        "sps": list_map(sentences, textstat.coleman_liau_index)
                                    },
                                    "automated_readability_index": {
                                        "score": textstat.automated_readability_index(message),
                                        "sps": list_map(sentences, textstat.automated_readability_index)
                                    },
                                    "dale_chall_readability_score": {
                                        "score": textstat.dale_chall_readability_score(message),
                                        "sps": list_map(sentences, textstat.dale_chall_readability_score)
                                    },
                                    "difficult_words": {
                                        "score": textstat.difficult_words(message),
                                        "sps": list_map(sentences, textstat.difficult_words),
                                        "words": textstat.difficult_words_list(message)
                                    },
                                    "linsear_write_formula": {
                                        "score": round(textstat.linsear_write_formula(message), 2),
                                        "sps": list_map(sentences, textstat.linsear_write_formula)
                                    },
                                    "gunning_fog": {
                                        "score": textstat.gunning_fog(message),
                                        "sps": list_map(sentences, textstat.gunning_fog)
                                    },
                                    "text_standard": {
                                        "score": textstat.text_standard(message)
                                    }
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


server: SimpleWebSocketServer = SimpleWebSocketServer("", config["port"], WebsocketHandler)
print("Starting websocket server")
server.serveforever()
