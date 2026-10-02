module.exports = {
  name: 'queue',
  description: 'Muestra la cola de reproducción actual',
  async execute(client, message, args) {
    const queue = client.distube.getQueue(message.guild.id);

    if (!queue) {
      return message.reply('⚠️ ¡La cola de reproducción está vacía!');
    }

    const q = queue.songs
      .map((song, i) => `${i === 0 ? '▶️ **Reproduciendo:**' : `\`${i}.\``} **${song.name}** - \`${song.formattedDuration}\``)
      .join('\n');

    const embed = {
      color: 0x5865F2,
      title: '🎶 Cola de Reproducción - Chillea Music',
      description: q.length > 2000 ? q.substring(0, 1997) + '...' : q,
      footer: { text: `Total de canciones en cola: ${queue.songs.length}` }
    };

    await message.reply({ embeds: [embed] });
  }
};