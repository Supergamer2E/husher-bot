export default async function(interaction) {
    global.autocorrectEnabled = !global.autocorrectEnabled;
    const status = global.autocorrectEnabled ? 'enabled' : 'disabled';
    await interaction.reply({ content: `🔁 Autocorrect has been **${status}**.`, flags: 1 << 6 });
}
