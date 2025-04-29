// commands/custom-comeback.js

export default async (interaction, context) => {
    const { loadCustomComebacks, saveCustomComebacks } = context;

    const defaultMessages = [
        '🧙 {user} has returned from the Forbidden Section of chat.',
        '💬 {user} can speak again. The silence was nice.',
        '🛏️ {user} has left the timeout dimension.',
        '🎮 {user} has re-entered the game.',
        '🔔 {user} has been released. Try to behave... maybe.',
        '🪓 {user} finished punching trees in Minecraft jail.',
        '📦 {user} was unboxed from the timeout container.',
        '🔧 {user} escaped the maintenance tunnel.',
        '🚪 {user} found the exit key.',
        '👀 {user} was seen wandering out of the hush dimension.',
        '💡 {user} remembered how to spell and was released.',
        '📚 {user} finished their spelling homework.',
        '🤖 {user} convinced the bot they were human again.',
        '🌐 {user} reconnected to the server.',
        '🪙 {user} inserted another quarter and continued playing.',
        '📀 {user} finished buffering and resumed the session.',
        '🐢 {user} slowly crawled back into the chat.',
        '🚀 {user} landed back from timeout orbit.',
        '💾 {user} has been restored from backup.',
        '🔒 {user} has been unlocked by an admin wizard.',
        '📉 {user} finally recovered from their typo recession.',
        '🧠 {user} leveled up in grammar skill.',
        '🧰 {user} used a crafting table to build an apology.',
        '📁 {user} was retrieved from the "Muted" archive.',
        '🧱 {user} broke out using a Redstone contraption.'
    ];

    const sub = interaction.options.getSubcommand();
    let list = loadCustomComebacks();

    if (sub === 'add') {
        const msg = interaction.options.getString('message');
        list.push(msg);
        saveCustomComebacks(list);
        await interaction.reply({ content: `✅ Added: \`${msg}\``, ephemeral: true });
    }

    if (sub === 'remove') {
        const i = interaction.options.getInteger('index');
        if (i < 0 || i >= list.length) {
            return await interaction.reply({ content: '❌ Invalid index.', ephemeral: true });
        }
        const removed = list.splice(i, 1);
        saveCustomComebacks(list);
        await interaction.reply({ content: `🗑️ Removed: \`${removed[0]}\``, ephemeral: true });
    }

    if (sub === 'list') {
        const merged = [...defaultMessages, ...list];
        const result = merged.map((msg, i) => `**${i}:** ${msg}`).join('\n') || 'No custom comebacks.';
        await interaction.reply({ content: result, ephemeral: true });
    }
};
