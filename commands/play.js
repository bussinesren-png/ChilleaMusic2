module.exports = {
    name: 'play',
    aliases: ['p'],
    description: 'Reproduce música desde YouTube u otras plataformas',
    async execute(client, message, args) {
        const query = args.join(' ');

        if (!query) {
            return message.reply('❌ ¡Debes escribir el nombre de una canción o un enlace de YouTube!');
        }

        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply('❌ ¡Tienes que estar conectado a un canal de voz para reproducir música!');
        }

        // Validar permisos del bot en el canal de voz
        const permissions = voiceChannel.permissionsFor(message.client.user);
        if (!permissions.has('Connect') || !permissions.has('Speak')) {
            return message.reply('❌ ¡No tengo permisos para unirme o hablar en ese canal de voz!');
        }

        try {
            await client.distube.play(voiceChannel, query, {
                textChannel: message.channel,
                member: message.member,
            });
        } catch (error) {
            console.error('Error detallado al reproducir:', error);
            message.reply(`❌ No se pudo reproducir la solicitud: \`${error.message || error}\``);
        }
    }
};