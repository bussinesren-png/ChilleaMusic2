require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits } = require('discord.js');

// 1. Configuración obligatoria de FFmpeg para Railway y la nube
const ffmpeg = require('ffmpeg-static');
// Aseguramos que la ruta se extraiga correctamente como string
const ffmpegPath = typeof ffmpeg === 'string' ? ffmpeg : ffmpeg.path;
process.env.FFMPEG_PATH = ffmpegPath;

const { DisTube } = require('distube');
const { SpotifyPlugin } = require('@distube/spotify');
const { SoundCloudPlugin } = require('@distube/soundcloud');
const { YtDlpPlugin } = require('@distube/yt-dlp');
const fs = require('fs');
const path = require('path');

// Intentar cargar el token desde config.json si existe
let tokenToUse = process.env.DISCORD_TOKEN;
const configPath = path.join(__dirname, 'config.json');
if (fs.existsSync(configPath)) {
    try {
        const configFile = require(configPath);
        if (configFile.token) {
            tokenToUse = configFile.token;
        }
    } catch (e) {
        // Ignorar si hay problemas leyendo el archivo local
    }
}

// 2. Configuración del Cliente de Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// Variables para el reproductor dinámico y el modo 24/7 por servidor
const activePlayers = new Map(); 
const mode247 = new Set();       

// 3. Configuración de DisTube (Con manejo de cookies y ffmpeg-static forzado)
const cookiesPath = path.join(__dirname, 'cookies.txt');
let ytDlpOptions = { update: true };

if (fs.existsSync(cookiesPath)) {
    console.log('[BOT] Archivo cookies.txt detectado en el directorio.');
    ytDlpOptions.cookies = cookiesPath;
} else {
    console.log('[AVISO] No se encontró cookies.txt. YouTube podría limitar las reproducciones.');
}

const distube = new DisTube(client, {
    ffmpegPath: ffmpegPath, // Ruta absoluta garantizada para evitar errores de ffmpeg no encontrado
    emitNewSongOnly: false,
    emitAddSongWhenCreatingQueue: false,
    emitAddListWhenCreatingQueue: true,
    savePreviousSongs: true,
    plugins: [
        new SpotifyPlugin(),
        new SoundCloudPlugin(),
        new YtDlpPlugin(ytDlpOptions)
    ]
});

client.commands = new Map();

// 4. Eventos del Bot
client.once('ready', () => {
    console.log(`[BOT] ¡${client.user.tag} está conectado y listo para reproducir!`);
});

// Evento: Bienvenida automática al unirse a un servidor
client.on('guildCreate', async guild => {
    const channel = guild.channels.cache.find(
        ch => ch.isTextBased() && ch.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages)
    );
    if (!channel) return;

    const welcomeEmbed = new EmbedBuilder()
        .setColor('#FF69B4')
        .setTitle('✨ ¡Gracias por invitarme a tu servidor!')
        .setDescription('¡Hola a todos! Soy **Chillea Music**, un bot de música diseñado para amenizar sus canales de voz.\n\n⚠️ **Aviso importante:** Al estar en desarrollo, es posible que encuentre algunos errores puntuales. Si notas algo raro, ten paciencia.')
        .addFields(
            { name: '🛠️ Creador', value: 'Creado con ❤️ por **R**', inline: true },
            { name: '🎵 ¿Cómo empezar?', value: 'Usa `!play [nombre, link de YouTube o link de Spotify]` para poner música o `!panel` (solo administradores) para abrir el panel de control y el modo Lo-Fi.', inline: false }
        )
        .setImage('https://i.imgur.com/he3uUsy.gif')
        .setFooter({ text: 'Chillea Music • ¡Disfruten de la música!' })
        .setTimestamp();

    try {
        await channel.send({ embeds: [welcomeEmbed] });
    } catch (e) {
        console.error('No se pudo enviar el mensaje de bienvenida en el servidor:', e);
    }
});

function getPlayerButtons() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('pause_resume').setLabel('⏸ Pausar').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('skip').setLabel('⏭ Saltar').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('stop').setLabel('⏹ Detener').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('previous').setLabel('⏮️ Anterior').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('loop').setLabel('🔁 Repetir').setStyle(ButtonStyle.Success)
    );
}

// 5. Eventos de DisTube
distube
    .on('playSong', async (queue, song) => {
        if (!queue.textChannel) return;

        const embed = new EmbedBuilder()
            .setColor('#9B59B6')
            .setTitle('🎶 Reproduciendo ahora')
            .setDescription(`[**${song.name}**](${song.url})`)
            .addFields(
                { name: '⏱ Duración', value: `\`${song.formattedDuration}\``, inline: true },
                { name: '👤 Pedido por', value: `${song.user}`, inline: true },
                { name: '📋 Canciones en cola', value: `\`${queue.songs.length}\``, inline: true }
            )
            .setThumbnail(song.thumbnail)
            .setFooter({ text: 'Chillea Music • Music Bot' });

        const row = getPlayerButtons();

        try {
            const previousMessage = activePlayers.get(queue.textChannel.guildId);
            if (previousMessage) {
                const edited = await previousMessage.edit({ embeds: [embed], components: [row] }).catch(() => null);
                if (!edited) {
                    const newMessage = await queue.textChannel.send({ embeds: [embed], components: [row] });
                    activePlayers.set(queue.textChannel.guildId, newMessage);
                }
            } else {
                const newMessage = await queue.textChannel.send({ embeds: [embed], components: [row] });
                activePlayers.set(queue.textChannel.guildId, newMessage);
            }
        } catch (e) {
            console.error('Error al actualizar el reproductor dinámico:', e);
        }
    })
    .on('addSong', (queue, song) => {
        if (queue.textChannel) {
            const embed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('✅ Añadido a la lista de reproducción')
                .setDescription(`[**${song.name}**](${song.url})`)
                .addFields(
                    { name: '⏱ Duración', value: `\`${song.formattedDuration}\``, inline: true },
                    { name: '📌 Posición en cola', value: `\`#${queue.songs.length - 1}\``, inline: true }
                )
                .setThumbnail(song.thumbnail)
                .setFooter({ text: 'Chillea Music • Music Bot' });

            queue.textChannel.send({ embeds: [embed] });
        }
    })
    .on('addList', (queue, playlist) => {
        if (queue.textChannel) {
            const embed = new EmbedBuilder()
                .setColor('#3498DB')
                .setTitle('📂 ¡Playlist añadida correctamente!')
                .setDescription(`[**${playlist.name}**](${playlist.url || ''})`)
                .addFields(
                    { name: '🎵 Canciones añadidas', value: `\`${playlist.songs.length}\``, inline: true },
                    { name: '⏱️ Duración estimada', value: `\`${playlist.formattedDuration || 'Desconocida'}\``, inline: true },
                    { name: '👤 Añadido por', value: `${playlist.user}`, inline: true }
                )
                .setThumbnail(playlist.thumbnail || playlist.songs[0]?.thumbnail)
                .setFooter({ text: 'Chillea Music • Music Bot' });

            queue.textChannel.send({ embeds: [embed] });
        }
    })
    .on('empty', queue => {
        const guildId = queue.textChannel?.guildId;
        if (guildId && mode247.has(guildId)) return;

        const embed = new EmbedBuilder()
            .setColor('#E74C3C')
            .setTitle('🚪 Canal vacío')
            .setDescription('El canal de voz se ha quedado sin gente. ¡Me desconecto para ahorrar energía!')
            .setFooter({ text: 'Chillea Music • Music Bot' });
        
        queue.textChannel?.send({ embeds: [embed] });
        activePlayers.delete(guildId);
    })
    .on('finish', queue => {
        const guildId = queue.textChannel?.guildId;
        if (guildId && mode247.has(guildId)) {
            const lofiUrl = 'https://www.youtube.com/watch?v=4xDzrJKXOOY'; 
            distube.play(queue.voiceChannel, lofiUrl, {
                textChannel: queue.textChannel,
                member: queue.client.user,
            }).catch(() => {});
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('#3498DB')
            .setTitle('🏁 Fin de la playlist / cola')
            .setDescription('Se han reproducido todas las canciones. ¡Usa `!play` para seguir añadiendo música!')
            .setFooter({ text: 'Chillea Music • Music Bot' });
        
        queue.textChannel?.send({ embeds: [embed] });
        activePlayers.delete(guildId);
    })
    .on('error', (error, queue, song) => {
        console.error('DisTube Error capturado:', error.message || error);
    });

// 6. Manejador de botones interactivos
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    
    if (interaction.customId === 'toggle_247_lofi') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Solo los administradores pueden activar o desactivar el modo Lo-Fi 24/7.', flags: [MessageFlags.Ephemeral] });
        }

        const guildId = interaction.guildId;
        const voiceChannel = interaction.member?.voice?.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: '⚠️ ¡Debes estar en un canal de voz para activar el modo Lo-Fi 24/7!', flags: [MessageFlags.Ephemeral] });
        }

        if (mode247.has(guildId)) {
            mode247.delete(guildId);
            return interaction.reply({ content: '🛑 **Modo 24/7 Lo-Fi desactivado**. El bot volverá a su comportamiento normal.', flags: [MessageFlags.Ephemeral] });
        } else {
            mode247.add(guildId);
            
            await interaction.reply({ content: '📻 **Modo 24/7 Lo-Fi activado**. Cargando música ambiental...', flags: [MessageFlags.Ephemeral] });

            const lofiUrl = 'https://www.youtube.com/watch?v=4xDzrJKXOOY';
            try {
                const queue = distube.getQueue(guildId);
                if (!queue) {
                    await distube.play(voiceChannel, lofiUrl, {
                        textChannel: interaction.channel,
                        member: interaction.member,
                    });
                }
            } catch (e) {
                console.error('Error al iniciar Lo-Fi:', e);
            }
            return;
        }
    }

    if (interaction.customId === 'panel_help') {
        return interaction.reply({ content: '💡 **Chillea Music Help**: Usa `!play [nombre o link]` para poner música o `!panel` para abrir este menú (Solo Administradores).', flags: [MessageFlags.Ephemeral] });
    }

    const queue = distube.getQueue(interaction.guildId);
    if (!queue) return interaction.reply({ content: '❌ No hay ninguna música reproduciéndose ahora mismo.', flags: [MessageFlags.Ephemeral] });

    if (!interaction.member.voice.channel) {
        return interaction.reply({ content: '⚠️ ¡Debes estar en el mismo canal de voz para usar los botones!', flags: [MessageFlags.Ephemeral] });
    }

    try {
        switch (interaction.customId) {
            case 'pause_resume':
                if (queue.paused) {
                    queue.resume();
                    await interaction.reply({ content: '▶️ Música reanudada.', flags: [MessageFlags.Ephemeral] });
                } else {
                    queue.pause();
                    await interaction.reply({ content: '⏸️ Música pausada.', flags: [MessageFlags.Ephemeral] });
                }
                break;
            case 'skip':
                if (queue.songs.length > 1) {
                    await distube.skip(interaction.guildId);
                    await interaction.reply({ content: '⏭️ Canción saltada.', flags: [MessageFlags.Ephemeral] });
                } else {
                    await interaction.reply({ content: '⚠️ No hay más canciones en cola para saltar.', flags: [MessageFlags.Ephemeral] });
                }
                break;
            case 'stop':
                await distube.stop(interaction.guildId);
                activePlayers.delete(interaction.guildId);
                await interaction.reply({ content: '⏹ Reproducción detenida y cola limpiada.', flags: [MessageFlags.Ephemeral] });
                break;
            case 'previous':
                try {
                    await distube.previous(interaction.guildId);
                    await interaction.reply({ content: '⏮️ Volviendo a la canción anterior...', flags: [MessageFlags.Ephemeral] });
                } catch {
                    await interaction.reply({ content: '❌ No hay canciones anteriores registradas.', flags: [MessageFlags.Ephemeral] });
                }
                break;
            case 'loop':
                const mode = distube.setRepeatMode(interaction.guildId);
                await interaction.reply({ content: `🔁 Modo de repetición cambiado: \`${mode ? (mode === 2 ? 'Cola completa' : 'Canción actual') : 'Desactivado'}\``, flags: [MessageFlags.Ephemeral] });
                break;
        }
    } catch (e) {
        console.error(e);
    }
});

// 7. Manejador de comandos de texto
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    
    const prefix = '!';
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    // Comando !play
    if (commandName === 'play') {
        const channel = message.member?.voice?.channel;
        if (!channel) return message.reply('¡Tienes que estar en un canal de voz para reproducir música!');
        const string = args.join(' ');
        if (!string) return message.reply('¡Por favor, escribe el nombre de una canción o un enlace (YouTube / Spotify)!');
        
        const statusMsg = await message.reply('🔍 *Buscando y procesando tu solicitud...*');

        try {
            await distube.play(channel, string, {
                textChannel: message.channel,
                member: message.member,
            });
            await statusMsg.delete().catch(() => {});
        } catch (error) {
            console.error('Error en comando play:', error);
            await statusMsg.edit('❌ Hubo un error al procesar este enlace o canción. Vuelve a intentar.').catch(() => {});
        }
    }

    // Comando !panel (EXCLUSIVO ADMINISTRADORES)
    if (commandName === 'panel' || commandName === 'control') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ No tienes permisos suficientes. Este comando es **exclusivo para administradores**.');
        }

        const embed = new EmbedBuilder()
            .setColor('#1ABC9C')
            .setTitle('🎛️ Panel de Control • Chillea Music')
            .setDescription('Selecciona una opción en los botones de abajo para configurar el bot o activar el flujo continuo en tu canal de voz.')
            .addFields(
                { name: '📻 Modo Lo-Fi 24/7', value: 'Mantiene el bot en el canal de voz reproduciendo música ambiental sin desconectarse.', inline: false },
                { name: '🎵 Comandos rápidos', value: '• `!play [nombre, link de YouTube o Spotify]`\n• También puedes usar los botones del reproductor en pantalla.', inline: false }
            )
            .setFooter({ text: 'Chillea Music • Panel exclusivo de administración' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('toggle_247_lofi').setLabel('📻 Activar/Desactivar Lo-Fi 24/7').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('panel_help').setLabel('❓ Ayuda').setStyle(ButtonStyle.Secondary)
        );

        return message.channel.send({ embeds: [embed], components: [row] });
    }
});

// 8. Inicio de sesión del Bot
if (!tokenToUse) {
    console.error('[ERROR CRÍTICO] No se encontró ningún token de Discord configurado en el archivo config.json ni en el entorno.');
} else {
    client.login(tokenToUse);
}