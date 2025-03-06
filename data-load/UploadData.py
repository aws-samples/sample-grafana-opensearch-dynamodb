from decimal import Decimal
import json
import boto3


def load_movies(movies, dynamodb=None):
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table('movies-datastore')
    for movie in movies:
        year = int(movie['year'])
        title = movie['title']
        print("Adding movie:", year, title)
        table.put_item(Item=movie)


if __name__ == '__main__':
    with open("moviedata_subset.json", encoding="utf-8") as json_file:
        movie_list = json.load(json_file, parse_float=Decimal)
    load_movies(movie_list)
