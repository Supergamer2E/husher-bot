// commands/custom-comeback.js
export default async function (interaction, { loadCustomComebacks, saveCustomComebacks }) {
    const sub = interaction.options.getSubcommand();
    let list = loadCustomComebacks();

    if (sub === 'add') {
        const msg = interaction.options.getString('message');
        list.push(msg);
        saveCustomComebacks(list);
        interaction.reply({ content: `✅ Added: \`${msg}\``, ephemeral: true });
    } else if (sub === 'remove') {
        const i = interaction.options.getInteger('index');
        if (i < 0 || i >= list.length) return interaction.reply({ content: '❌ Invalid index.', ephemeral: true });
        const removed = list.splice(i, 1);
        saveCustomComebacks(list);
        interaction.reply({ content: `🗑️ Removed: \`${removed[0]}\``, ephemeral: true });
    } else if (sub === 'list') {
        const result = list.map((msg, i) => `**${i}:** ${msg}`).join('\n') || 'No custom comebacks.';
        interaction.reply({ content: result, ephemeral: true });
    }
}