from flask import Flask, request
from flask_cors import cross_origin
import json

from language_tool_python import LanguageTool, Match
from sentence_splitter import SentenceSplitter
from textstat import textstat

app = Flask(__name__)

with open('./config.json') as configuration:
    config: dict = json.loads(configuration.read())

splitter = SentenceSplitter(language='en')


def match_to_dict(match: Match) -> dict:
    return {
        'ruleId': match.ruleId,
        'message': match.message,
        'replacements': match.replacements,  # The possible replacement options
        'offsetInContext': match.offsetInContext,
        'context': match.context,
        'offset': match.offset,
        'errorLength': match.errorLength,
        'category': match.category,
        'ruleIssueType': match.ruleIssueType,
        'sentence': match.sentence
    }


def list_map(input_list: list, function) -> list:
    mapped = map(lambda x: function(x), input_list)
    return list(mapped)


@app.route('/', methods=['POST'])
@cross_origin()
def index():
    data = request.json
    print(f'Debug: {data}')

    unique_id = data['unique_id']
    process_language = data['process_language']
    message = data['message']

    matches_list = None
    if process_language:
        # Language tool takes a while to process
        language_tool = LanguageTool('en-US')
        matches: list[Match] = language_tool.check(message)

        matches_list = []
        for match in matches:
            matches_list.append(match_to_dict(match))
        print(f'Analysis finished: {matches_list}')

    sentences: list = splitter.split(text=message)

    return {
        'unique_id': unique_id,
        'text_statistics': {
            'lexicon_count': textstat.lexicon_count(message),
            'lexicon_count_ps': list_map(sentences, textstat.lexicon_count),
            'syllable_count': textstat.syllable_count(message),
            'syllable_count_ps': list_map(sentences, textstat.syllable_count),
            'sentences': sentences,
            'sentence_count': len(sentences),
            'readability': {
                'flesch_reading_ease': {
                    'score': textstat.flesch_reading_ease(message),
                    'sps': list_map(sentences, textstat.flesch_reading_ease)
                },
                'smog_index': {
                    'score': textstat.smog_index(message)
                },
                'flesch_kincaid_grade': {
                    'score': textstat.flesch_kincaid_grade(message),
                    'sps': list_map(sentences, textstat.flesch_kincaid_grade)
                },
                'coleman_liau_index': {
                    'score': textstat.coleman_liau_index(message),
                    'sps': list_map(sentences, textstat.coleman_liau_index)
                },
                'automated_readability_index': {
                    'score': textstat.automated_readability_index(message),
                    'sps': list_map(sentences, textstat.automated_readability_index)
                },
                'dale_chall_readability_score': {
                    'score': textstat.dale_chall_readability_score(message),
                    'sps': list_map(sentences, textstat.dale_chall_readability_score)
                },
                'difficult_words': {
                    'score': textstat.difficult_words(message),
                    'sps': list_map(sentences, textstat.difficult_words),
                    'words': textstat.difficult_words_list(message)
                },
                'linsear_write_formula': {
                    'score': round(textstat.linsear_write_formula(message), 2),
                    'sps': list_map(sentences, textstat.linsear_write_formula)
                },
                'gunning_fog': {
                    'score': textstat.gunning_fog(message),
                    'sps': list_map(sentences, textstat.gunning_fog)
                },
                'text_standard': {
                    'score': textstat.text_standard(message)
                }
            }
        },
        'language_tool': matches_list
    }


app.run('127.0.0.1', config['port'], True)
