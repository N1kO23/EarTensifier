const { MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');

const DatabaseHelper = require('../../helpers/DatabaseHelper');
const Event = require('../../structures/Event');
const formatDuration = require('../../utils/music/formatDuration');

module.exports = class TrackStart extends Event {
    constructor(...args) {
        super(...args);
    }

    async run(player, track) {
        const { id, title, url, platform, requester, author, thumbnail } = track;
        const duration = player.getDuration() || track.duration;

        this.client.databaseHelper.incrementTotalSongsPlayed();
        this.client.databaseHelper.incrementTimesSongsPlayed(id, title, url, duration, platform, thumbnail, author);
        this.client.databaseHelper.incrementUserSongsPlayed(requester);

        const shouldSend = await DatabaseHelper.shouldSendNowPlayingMessage(player.textChannel.guild);
        if (!shouldSend) return;

        if (player.nowPlayingMessage) player.nowPlayingMessage = null;
        if (player.nowPlayingMessageInterval) clearInterval(player.nowPlayingMessageInterval);

        const n = 13;
        let parsedCurrentDuration = formatDuration(0);
        let parsedDuration = formatDuration(duration);
        let part = ~~((player.getTime() / duration) * n);
        let percentage = player.getTime() / duration;

        const buttonRow = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setCustomId('PREVIOUS_BUTTON')
                    .setStyle('SECONDARY')
                    .setEmoji(this.client.config.emojis.previous),
                new MessageButton()
                    .setCustomId('PAUSE_BUTTON')
                    .setStyle('PRIMARY')
                    .setEmoji(this.client.config.emojis.pause),
                new MessageButton()
                    .setCustomId('SKIP_BUTTON')
                    .setStyle('SECONDARY')
                    .setEmoji(this.client.config.emojis.skip));

        try {
            const embed = new MessageEmbed()
                .setColor(this.client.config.colors.default)
                .setAuthor(author, player.playing ? 'https://eartensifier.net/images/cd.gif' : 'https://eartensifier.net/images/cd.png', url)
                .setThumbnail(thumbnail)
                .setTitle(title)
                .setURL(url)
                .setDescription(`${parsedCurrentDuration}  ${percentage < 0.05 ? this.client.config.emojis.progress7 : this.client.config.emojis.progress1}${this.client.config.emojis.progress2.repeat(part)}${percentage < 0.05 ? '' : this.client.config.emojis.progress3}${this.client.config.emojis.progress5.repeat(12 - part)}${this.client.config.emojis.progress6}  ${parsedDuration}`)
                .setFooter(requester.username)
                .setTimestamp();
            player.nowPlayingMessage = await player.textChannel.send({ embeds: [embed], components: [buttonRow] });

            if (!player.nowPlayingMessageInterval) player.nowPlayingMessageInterval = setInterval(() => {
                if (!player.player || !player.nowPlayingMessage) return clearInterval(player.nowPlayingMessageInterval);
                parsedCurrentDuration = formatDuration(player.getTime());
                parsedDuration = formatDuration(duration);
                part = ~~((player.getTime() / duration) * n);
                percentage = player.getTime() / duration;

                const e = new MessageEmbed(embed.setDescription(`${parsedCurrentDuration}  ${percentage < 0.05 ? this.client.config.emojis.progress7 : this.client.config.emojis.progress1}${this.client.config.emojis.progress2.repeat(part)}${percentage < 0.05 ? '' : this.client.config.emojis.progress3}${this.client.config.emojis.progress5.repeat(12 - part)}${this.client.config.emojis.progress6}  ${parsedDuration}`));
                if (player.nowPlayingMessage) player.nowPlayingMessage.edit({ content: null, embeds: [e] });
            }, 60000);
        }
        catch (err) {
            this.client.logger.error(err);
        }
    }
};
