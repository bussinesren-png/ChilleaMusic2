module.exports = {
  name: 'pause',
  description: 'Pausa la música actual',
  async execute(client, message, args) {
    const queue = client.distube.getQueue(message.guild.id);

    if (!queue) {
      return message.reply('⚠️ ¡No hay nada reproduciéndose en este momento!');
    }

    if (queue.paused) {
      return message.reply('⚠️ ¡La música ya está pausada! Usa `!resume` para reanudarla.');
    }

    try {
      queue.pause();
      await message.react('⏸️');
    } catch (error) {
      console.error(error);
      await message.reply('❌ Ocurrió un error al intentar pausar la música.');
    }
  }
};