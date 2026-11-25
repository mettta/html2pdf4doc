import os

from seleniumbase import BaseCase

from test.end2end.helpers.helper import Helper

path_to_this_test_file_folder = os.path.dirname(os.path.abspath(__file__))

intro = '//*[@data-testid="intro"]'
section = '//*[@data-testid="section"]'


class Test(BaseCase):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.helper = Helper(self)

        #   Several page break rules can resolve to the same element.
        #   They must insert only one page break, so no empty page appears.

    def test_nested(self):
        # "section h2": the H2 climbs to its SECTION parent.
        self.helper.open_case(path_to_this_test_file_folder, 'nested')
        self.helper.assert_document_has_pages(2)
        self.helper.assert_element_on_the_page(intro, 1)
        self.helper.assert_element_on_the_page(section, 2)

    def test_before_and_forced(self):
        # The same element matches a "before" and a forced selector.
        self.helper.open_case(path_to_this_test_file_folder, 'before_and_forced')
        self.helper.assert_document_has_pages(2)
        self.helper.assert_element_on_the_page(intro, 1)
        self.helper.assert_element_on_the_page(section, 2)

    def test_selector_order(self):
        # The element that starts the content is not the first match in
        # the list, because the matches are grouped by selector.
        self.helper.open_case(path_to_this_test_file_folder, 'selector_order')
        self.helper.assert_document_has_pages(2)
        self.helper.assert_element_on_the_page(intro, 1)
        self.helper.assert_element_on_the_page(section, 2)
