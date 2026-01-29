import { MediaSchemaType } from '../../../database/types';

export type MediaDataType = Omit<MediaSchemaType, 'id' | 'publicId' | 'createdAt' | 'updatedAt'>;

export type MediaResponseType = Omit<
	MediaDataType,
	| 'duration'
	| 'filename'
	| 'fileExtension'
	| 'storageMetadata'
	| 'description'
	| 'caption'
	| 'storageKey'
	| 'uploadedBy'
> & {
	createdAt?: Date;
	updatedAt?: Date;
};

export type MediaDeleteResponseType = MediaResponseType & {
	storageKey: string;
};
