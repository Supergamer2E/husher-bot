export default async function(interaction, { whitelist }) {
    const word = interaction.options.getString('word').toLowerCase();
    if (!whitelist.includes(word)) {
        whitelist.push(word);
        await interaction.reply({ content: `✅ Added \`${word}\` to the whitelist.`, flags: 1 << 6 });
    } else {
        await interaction.reply({ content: `ℹ️ \`${word}\` is already in the whitelist.`, flags: 1 << 6 });
    }
}
