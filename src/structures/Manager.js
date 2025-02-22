const { Source } = require('yasha');
const { Collection } = require('discord.js');
const EventEmitter = require('events');
const { TrackPlaylist } = require('yasha/src/Track');

const Player = require('./Player');
const QueueHelper = require('../helpers/QueueHelper');
const DatabaseHelper = require('../helpers/DatabaseHelper');
const Logger = require('./Logger');

module.exports = class Manager extends EventEmitter {
    constructor() {
        super();
        this.players = new Collection();

        this.logger = new Logger({
            displayTimestamp: true,
            displayDate: true,
        });
    }

    async newPlayer(guild, voiceChannel, textChannel, volume) {
        const player = new Player({
            manager: this,
            guild: guild,
            voiceChannel: voiceChannel,
            textChannel: textChannel,
            volume: volume ? volume : await DatabaseHelper.getDefaultVolume(guild),
        });

        this.players.set(player.guild.id, player);

        player.on('ready', () => {
            this.trackStart(player);
        });

        player.on('finish', () => {
            this.trackEnd(player, true);
        });

        player.on('error', (err) => {
            this.logger.error(`${player.queue.current.id} ${err}`);
            player.skip();
        });

        return player;
    }

    trackStart(player) {
        player.playing = true;
        player.paused = false;

        const track = player.queue.current;
        this.emit('trackStart', player, track);
    }

    trackEnd(player, finished) {
        const track = player.queue.current;
        if (!track.duration) track.duration = player.getDuration();

        if (track && player.trackRepeat) {
            this.emit('trackEnd', player, track, finished);
            player.play();
            return;
        }

        if (track && player.queueRepeat) {
            player.queue.add(player.queue.current);
            player.queue.current = player.queue.shift();

            this.emit('trackEnd', player, track, finished);
            player.play();
            return;
        }

        if (player.queue.length > 0) {
            player.queue.current = player.queue.shift();

            this.emit('trackEnd', player, track, finished);
            player.play();
            return;
        }

        if (!player.queue.length && player.queue.current) {
            this.emit('trackEnd', player, track, finished);
            player.stop();
            player.queue.current = null;
            player.playing = false;
            return this.queueEnd(player, track);
        }
    }

    queueEnd(player, track) {
        this.emit('queueEnd', player, track);
    }

    get(guild) {
        return this.players.get(guild.id);
    }

    destroy(guild) {
        this.players.delete(guild.id);
    }

    async search(query, requester, s) {
        let track;
        let source = s;

        try {
            switch (source) {
                case 'soundcloud':
                    track = (await Source.Soundcloud.search(query))[0];
                    break;
                case 'spotify':
                    track = await Source.resolve(query);
                    break;
                case 'youtube':
                    track = (await Source.Youtube.search(query))[0];
                    break;
                default:
                    track = await Source.resolve(query);
                    break;
            }

            if (!track) {
                track = (await Source.Youtube.search(query))[0];
                source = 'youtube';
            }

            if (!track) throw new Error('No track found');
            else {
                if (track instanceof TrackPlaylist) {
                    track.forEach(t => {
                        t.requester = requester;
                        t.icon = null;
                        t.thumbnail = QueueHelper.reduceThumbnails(t.thumbnails);
                    });
                }
                else {
                    track.requester = requester;
                    track.icon = null;
                    track.thumbnail = QueueHelper.reduceThumbnails(track.thumbnails);
                }
                return track;
            }
        }
        catch (err) {
            throw new Error(err);
        }
    }

    getPlayingPlayers() {
        return this.players.filter(p => p.playing);
    }
};