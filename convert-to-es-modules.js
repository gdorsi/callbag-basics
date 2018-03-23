import lebab from 'lebab';

export default function convert() {

    return {
        name: 'convert-to-es-modules',
        transform(code) {
            return lebab.transform(code, ['commonjs']);
        },
    };
}
