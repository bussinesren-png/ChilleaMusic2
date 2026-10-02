module.exports = {
  name: 'stop',
  description: 'Detiene la música y desconecta al bot del canal de voz',
  async execute(client, message, args) {
    const queue = client.distube.getQueue(message.guild.id);

    if (!queue) {
      return message.reply('⚠️ ¡No hay ninguna canción reproduciéndose actualmente!');
    }

    try {
      await queue.stop();
      await message.react('⏹️');
    } catch (error) {
      console.error(error);
      await message.reply('❌ Hubo un error al intentar detener la música.');
    }
  }
};