export default async function(interaction, { whitelist }) {
    const word = interaction.options.getString('word').toLowerCase();
    const index = whitelist.indexOf(word);
    if (index !== -1) {
        whitelist.splice(index, 1);
        await interaction.reply({ content: `🗑️ Removed \`${word}\` from the whitelist.`, flags: 1 << 6 });
    } else {
        await interaction.reply({ content: `❌ \`${word}\` is not in the whitelist.`, flags: 1 << 6 });
    }
}
