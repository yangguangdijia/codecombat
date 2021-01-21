CocoModel = require './CocoModel'

module.exports = class TournamentMatch extends CocoModel
  @className: 'TournamentMatch'
  @schema: require 'schemas/models/tournament_match'
  urlRoot: '/db/tournament.match'